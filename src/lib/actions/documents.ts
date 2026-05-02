'use server'

import { createServerClient } from '@/lib/supabase/server'
import { writeAuditLog }      from '@/lib/actions/audit'
import { hashFile, hashString } from '@/lib/utils/hash'
import { nextVersion }         from '@/lib/utils/versioning'
import { revalidatePath }      from 'next/cache'
import { redirect }            from 'next/navigation'
import { z }                   from 'zod'

// ── Validation Schemas ──────────────────────────────────────────────────────

const UploadSchema = z.object({
  documentId:    z.string().uuid(),
  changeSummary: z.string().min(10, 'Change summary must be at least 10 characters').max(500),
  isMajor:       z.boolean(),
})

const CreateDocumentSchema = z.object({
  folderId:       z.string().uuid(),
  docCode:        z.string().regex(/^\d{4}-[A-Z]{2,6}-[A-Z]{2,4}-\d{3}$/, 'Invalid doc code format'),
  title:          z.string().min(3).max(200),
  docType:        z.enum(['policy','procedure','work_instruction','form','record']),
  functionalArea: z.string().min(2).max(10),
  securityClass:  z.enum(['public','internal','confidential','restricted']),
  retentionYears: z.coerce.number().int().min(1).max(30),
})

// ── Server Actions ──────────────────────────────────────────────────────────

/**
 * Create a new document record (without file — file comes via uploadRevision)
 */
export async function createDocument(formData: FormData) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.app_metadata?.role as string
  if (!['editor','admin'].includes(role)) {
    return { ok: false, error: 'Insufficient permissions — Editor role required' }
  }

  const parsed = CreateDocumentSchema.safeParse({
    folderId:       formData.get('folderId'),
    docCode:        formData.get('docCode'),
    title:          formData.get('title'),
    docType:        formData.get('docType'),
    functionalArea: formData.get('functionalArea'),
    securityClass:  formData.get('securityClass'),
    retentionYears: formData.get('retentionYears'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      folder_id:       parsed.data.folderId,
      doc_code:        parsed.data.docCode,
      title:           parsed.data.title,
      doc_type:        parsed.data.docType,
      functional_area: parsed.data.functionalArea,
      security_class:  parsed.data.securityClass,
      retention_years: parsed.data.retentionYears,
      owner_id:        user.id,
      status:          'draft',
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  await writeAuditLog({
    event_type:  'document_created',
    actor_id:    user.id,
    document_id: data.id,
    metadata:    { doc_code: parsed.data.docCode, title: parsed.data.title },
  })

  revalidatePath('/documents')
  return { ok: true, documentId: data.id }
}

/**
 * Upload a new revision file for an existing document.
 * Handles: validation → auth gate → version calc → file hash →
 *          storage upload → revision insert → audit log → doc pointer update
 */
export async function uploadRevision(
  formData: FormData
): Promise<{ ok: boolean; error?: string; revisionId?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthenticated' }

  // 1. Parse & validate form inputs
  const parsed = UploadSchema.safeParse({
    documentId:    formData.get('documentId'),
    changeSummary: formData.get('changeSummary'),
    isMajor:       formData.get('isMajor') === 'true',
  })
  if (!parsed.success) {
    return { ok: false, error: JSON.stringify(parsed.error.flatten()) }
  }

  const { documentId, changeSummary, isMajor } = parsed.data

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false, error: 'No file provided' }
  if (file.size > 52_428_800)   return { ok: false, error: 'File exceeds 50 MB limit' }

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: 'Only PDF and DOCX files are accepted' }
  }

  // 2. Server-side authorisation check (defence in depth beyond RLS)
  const role = user.app_metadata?.role as string
  if (!['editor','admin'].includes(role)) {
    return { ok: false, error: 'Insufficient permissions — Editor role required' }
  }

  // 3. Fetch latest revision to compute next version number
  const { data: latest } = await supabase
    .from('revisions')
    .select('major, minor')
    .eq('document_id', documentId)
    .order('major',  { ascending: false })
    .order('minor',  { ascending: false })
    .limit(1)
    .single()

  const { major, minor } = nextVersion(latest, isMajor)

  // 4. Compute SHA-256 for immutable file integrity record
  const fileBuffer = await file.arrayBuffer()
  const fileHash   = await hashFile(fileBuffer)

  // 5. Upload to private Supabase Storage (append-only — upsert: false)
  const storagePath = `drafts/${documentId}/V${major}.${minor}/${file.name}`
  const { error: uploadErr } = await supabase.storage
    .from('documents-private')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,  // Never overwrite existing versions
    })

  if (uploadErr) return { ok: false, error: `Storage error: ${uploadErr.message}` }

  // 6. Insert revision row (Supabase Storage webhook triggers watermark Edge Function)
  const { data: revision, error: revErr } = await supabase
    .from('revisions')
    .insert({
      document_id:    documentId,
      major,
      minor,
      storage_path:   storagePath,
      file_hash:      fileHash,
      change_summary: changeSummary,
      authored_by:    user.id,
    })
    .select('id')
    .single()

  if (revErr) return { ok: false, error: revErr.message }

  // 7. Write immutable audit log entry
  await writeAuditLog({
    event_type:  'revision_uploaded',
    actor_id:    user.id,
    document_id: documentId,
    revision_id: revision.id,
    metadata: {
      major,
      minor,
      file_hash:    fileHash,
      is_major:     isMajor,
      file_name:    file.name,
      file_size:    file.size,
    },
  })

  // 8. Advance document's current_rev_id pointer + reset status to draft
  await supabase
    .from('documents')
    .update({ current_rev_id: revision.id, status: 'draft' })
    .eq('id', documentId)

  revalidatePath(`/documents/${documentId}`)
  revalidatePath('/register')
  return { ok: true, revisionId: revision.id }
}

/**
 * Submit a document revision for review.
 * Assigns reviewers and transitions status to 'under_review'.
 */
export async function submitForReview(
  documentId: string,
  reviewerIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthenticated' }

  if (!reviewerIds.length) {
    return { ok: false, error: 'At least one reviewer is required' }
  }

  // Transition status
  const { error: statusErr } = await supabase
    .from('documents')
    .update({ status: 'under_review' })
    .eq('id', documentId)
    .eq('status', 'draft') // Only draft docs can be submitted

  if (statusErr) return { ok: false, error: statusErr.message }

  // Assign reviewers
  const reviewerRows = reviewerIds.map((rid) => ({
    document_id:  documentId,
    reviewer_id:  rid,
    status:       'pending' as const,
  }))

  const { error: revErr } = await supabase
    .from('document_reviewers')
    .upsert(reviewerRows, { onConflict: 'document_id,reviewer_id' })

  if (revErr) return { ok: false, error: revErr.message }

  await writeAuditLog({
    event_type:  'submitted_for_review',
    actor_id:    user.id,
    document_id: documentId,
    metadata:    { reviewer_ids: reviewerIds },
  })

  revalidatePath(`/documents/${documentId}`)
  return { ok: true }
}

/**
 * Approve a document revision with an electronic signature.
 * The e-sig token is hashed before storage — the raw token is never persisted.
 */
export async function approveDocument(
  revisionId: string,
  esigToken:  string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthenticated' }

  const role = user.app_metadata?.role as string
  if (!['reviewer','admin'].includes(role)) {
    return { ok: false, error: 'Approver role required' }
  }

  // Hash the e-sig token (NEVER store raw token)
  const esigHash = await hashString(esigToken)

  const { data: rev, error } = await supabase
    .from('revisions')
    .update({
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      esig_hash:   esigHash,
    })
    .eq('id', revisionId)
    .select('document_id')
    .single()

  if (error) return { ok: false, error: error.message }

  // Promote document to approved status + set effective date
  await supabase
    .from('documents')
    .update({
      status:         'approved',
      effective_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', rev.document_id)

  await writeAuditLog({
    event_type:  'document_approved',
    actor_id:    user.id,
    revision_id: revisionId,
    document_id: rev.document_id,
    metadata:    { esig_hash: esigHash },
  })

  revalidatePath(`/documents/${rev.document_id}`)
  revalidatePath('/register')
  return { ok: true }
}

/**
 * Reject a document revision with mandatory reason.
 */
export async function rejectDocument(
  revisionId:    string,
  rejectionNote: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthenticated' }

  const role = user.app_metadata?.role as string
  if (!['reviewer','admin'].includes(role)) {
    return { ok: false, error: 'Reviewer role required' }
  }

  // Revert document to draft
  const { data: rev } = await supabase
    .from('revisions')
    .select('document_id')
    .eq('id', revisionId)
    .single()

  if (!rev) return { ok: false, error: 'Revision not found' }

  await supabase
    .from('documents')
    .update({ status: 'draft' })
    .eq('id', rev.document_id)

  await writeAuditLog({
    event_type:  'document_rejected',
    actor_id:    user.id,
    revision_id: revisionId,
    document_id: rev.document_id,
    metadata:    { rejection_note: rejectionNote },
  })

  revalidatePath(`/documents/${rev.document_id}`)
  return { ok: true }
}

/**
 * Retire / obsolete a document.
 * Requires admin role. Superseding document ID should be provided if available.
 */
export async function obsoleteDocument(
  documentId:        string,
  reason:            string,
  supersededById?:   string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthenticated' }

  const role = user.app_metadata?.role as string
  if (role !== 'admin') {
    return { ok: false, error: 'Admin role required to obsolete documents' }
  }

  const { error } = await supabase
    .from('documents')
    .update({ status: 'obsolete' })
    .eq('id', documentId)
    .neq('status', 'obsolete') // Idempotency guard

  if (error) return { ok: false, error: error.message }

  await writeAuditLog({
    event_type:  'document_obsoleted',
    actor_id:    user.id,
    document_id: documentId,
    metadata:    { reason, superseded_by: supersededById ?? null },
  })

  revalidatePath('/register')
  revalidatePath(`/documents/${documentId}`)
  return { ok: true }
}

// ── Combined create + initial upload ────────────────────────────────────────

import { generateDocCode } from '@/lib/utils/doccode'

const CreateWithUploadSchema = z.object({
  title:          z.string().min(3, 'Title must be at least 3 characters').max(200),
  docType:        z.enum(['policy','procedure','work_instruction','form','record']),
  functionalArea: z.string().min(2).max(10),
  securityClass:  z.enum(['public','internal','confidential','restricted']),
  retentionYears: z.coerce.number().int().min(1).max(30),
  changeSummary:  z.string().min(10, 'Change summary must be at least 10 characters').max(500),
})

/**
 * Create a brand-new document AND upload its first revision in one shot.
 * - Picks/creates a folder for the user's department
 * - Generates the next doc code (YYMM-AREA-TYPE-NNN)
 * - Hashes & stores the file
 * - Inserts document row + V1.0 revision row
 * - Writes the audit log
 *
 * Returns the new document id on success.
 */
export async function createDocumentWithUpload(formData: FormData): Promise<
  { ok: true; documentId: string; docCode: string }
  | { ok: false; error: string }
> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthenticated' }

  const role = user.app_metadata?.role as string | undefined
  if (!role || !['editor', 'admin'].includes(role)) {
    return { ok: false, error: 'Insufficient permissions — Editor or Admin role required' }
  }

  // Validate metadata
  const parsed = CreateWithUploadSchema.safeParse({
    title:          formData.get('title'),
    docType:        formData.get('docType'),
    functionalArea: formData.get('functionalArea'),
    securityClass:  formData.get('securityClass'),
    retentionYears: formData.get('retentionYears'),
    changeSummary:  formData.get('changeSummary'),
  })
  if (!parsed.success) {
    const firstErr = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { ok: false, error: firstErr ?? 'Invalid form input' }
  }

  // Validate file
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false, error: 'A file is required' }
  if (file.size > 52_428_800) return { ok: false, error: 'File exceeds 50 MB limit' }

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: 'Only PDF and DOCX files are accepted' }
  }

  // Find or create a folder for this functional area
  let folderId: string
  const { data: existingFolder } = await supabase
    .from('folders')
    .select('id')
    .eq('functional_area', parsed.data.functionalArea)
    .limit(1)
    .maybeSingle()

  if (existingFolder) {
    folderId = existingFolder.id
  } else {
    const { data: newFolder, error: folderErr } = await supabase
      .from('folders')
      .insert({
        name:            parsed.data.functionalArea,
        path:            `/${parsed.data.functionalArea.toLowerCase()}`,
        functional_area: parsed.data.functionalArea,
        owner_dept:      parsed.data.functionalArea,
        created_by:      user.id,
      })
      .select('id')
      .single()
    if (folderErr || !newFolder) {
      return { ok: false, error: `Could not create folder: ${folderErr?.message ?? 'unknown'}` }
    }
    folderId = newFolder.id
  }

  // Compute next sequence for doc code in this area+type+month
  const yymm = (() => {
    const d = new Date()
    return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const codePrefix = `${yymm}-${parsed.data.functionalArea.toUpperCase()}-`
  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .like('doc_code', `${codePrefix}%`)

  const sequence = (count ?? 0) + 1
  const docCode = generateDocCode(parsed.data.functionalArea, parsed.data.docType, sequence)

  // Insert the document row
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      folder_id:       folderId,
      doc_code:        docCode,
      title:           parsed.data.title,
      doc_type:        parsed.data.docType,
      functional_area: parsed.data.functionalArea,
      security_class:  parsed.data.securityClass,
      retention_years: parsed.data.retentionYears,
      owner_id:        user.id,
      status:          'draft',
    })
    .select('id')
    .single()

  if (docErr || !doc) {
    return { ok: false, error: `Could not create document: ${docErr?.message ?? 'unknown'}` }
  }

  // Hash + upload to storage
  const fileBuffer = await file.arrayBuffer()
  const fileHash   = await hashFile(fileBuffer)
  const storagePath = `drafts/${doc.id}/V1.0/${file.name}`

  const { error: uploadErr } = await supabase.storage
    .from('documents-private')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    // Roll back the document row so we don't leave orphans
    await supabase.from('documents').delete().eq('id', doc.id)
    return { ok: false, error: `Storage error: ${uploadErr.message}. Did you create the 'documents-private' bucket?` }
  }

  // Insert V1.0 revision
  const { data: rev, error: revErr } = await supabase
    .from('revisions')
    .insert({
      document_id:    doc.id,
      major:          1,
      minor:          0,
      storage_path:   storagePath,
      file_hash:      fileHash,
      change_summary: parsed.data.changeSummary,
      authored_by:    user.id,
    })
    .select('id')
    .single()

  if (revErr || !rev) {
    return { ok: false, error: `Could not create revision: ${revErr?.message ?? 'unknown'}` }
  }

  // Point the document to its new revision
  await supabase
    .from('documents')
    .update({ current_rev_id: rev.id })
    .eq('id', doc.id)

  // Audit log
  await writeAuditLog({
    event_type:  'document_created',
    actor_id:    user.id,
    document_id: doc.id,
    revision_id: rev.id,
    metadata: {
      doc_code:  docCode,
      title:     parsed.data.title,
      file_hash: fileHash,
      file_name: file.name,
      file_size: file.size,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/documents')

  return { ok: true, documentId: doc.id, docCode }
}

