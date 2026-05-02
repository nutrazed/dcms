import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts, degrees } from 'https://esm.sh/pdf-lib@1.17.1'

/**
 * DCMS Edge Function: watermark-pdf
 * Triggered via Supabase Storage webhook when a file is uploaded to documents-private.
 * Applies a diagonal watermark with user ID + timestamp to every page,
 * injects XMP metadata, then writes the result to documents-preview.
 */
serve(async (req) => {
  try {
    const { record } = await req.json()  // Storage webhook payload

    if (!record?.name?.endsWith('.pdf')) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Not a PDF' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Download original from private bucket
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from('documents-private')
      .download(record.name)

    if (dlErr) throw new Error(`Download failed: ${dlErr.message}`)

    // 2. Load PDF
    const pdfBytes = await fileBlob.arrayBuffer()
    const pdfDoc   = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    const font     = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // 3. Build watermark text from webhook metadata
    const meta     = record.metadata ?? {}
    const userId   = meta.user_id ?? 'SYSTEM'
    const docCode  = meta.doc_code ?? 'UNKNOWN'
    const version  = meta.version  ?? '—'
    const stamp    = `CONTROLLED COPY | ${docCode} ${version} | User: ${userId} | ${new Date().toISOString().slice(0,16)} UTC`

    // 4. Stamp every page
    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize()

      // Diagonal background watermark
      page.drawText(stamp, {
        x: 60,
        y: height / 2 - 20,
        size: 11,
        font,
        color: rgb(0.65, 0.65, 0.65),
        opacity: 0.30,
        rotate: degrees(45),
      })

      // Bottom footer strip
      page.drawText(
        `DCMS Controlled Document — Do not distribute without authorisation`,
        {
          x: 40,
          y: 18,
          size: 7,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.7,
        }
      )
    }

    // 5. Inject XMP metadata
    pdfDoc.setTitle(meta.doc_title ?? 'Controlled Document')
    pdfDoc.setKeywords([docCode, version, 'DCMS', 'Controlled'])
    pdfDoc.setCreationDate(new Date())
    pdfDoc.setModificationDate(new Date())
    pdfDoc.setProducer('DCMS Watermark Service v2')

    // 6. Save watermarked PDF
    const watermarked = await pdfDoc.save()

    // 7. Upload to preview bucket (path mirrors private bucket)
    const previewPath = record.name.replace(/^drafts\//, 'preview/')
    const { error: upErr } = await supabase.storage
      .from('documents-preview')
      .upload(previewPath, watermarked, {
        contentType: 'application/pdf',
        upsert: true,
        metadata: {
          doc_code:   docCode,
          version:    version,
          user_id:    userId,
          watermarked_at: new Date().toISOString(),
        }
      })

    if (upErr) throw new Error(`Preview upload failed: ${upErr.message}`)

    // 8. Update revision row with preview path
    if (meta.revision_id) {
      await supabase
        .from('revisions')
        .update({ storage_path: previewPath })
        .eq('id', meta.revision_id)
        .eq('storage_path', record.name) // safety guard
    }

    return new Response(
      JSON.stringify({ ok: true, source: record.name, preview: previewPath }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[watermark-pdf]', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
