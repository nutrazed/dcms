'use server'

import { createServerClient } from '@/lib/supabase/server'
import { hashString } from '@/lib/utils/hash'
import { headers } from 'next/headers'
import type { Json } from '@/types/database.types'

export interface AuditPayload {
  event_type: string
  actor_id: string
  document_id?: string
  revision_id?: string
  metadata?: Record<string, unknown>
}

/**
 * Write a tamper-evident audit log entry.
 * Computes a hash chain: each row stores the hash of its own content
 * plus the hash of the previous row, enabling integrity verification.
 */
export async function writeAuditLog(payload: AuditPayload): Promise<void> {
  const supabase = await createServerClient()
  const headersList = await headers()

  const ip        = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  const userAgent = headersList.get('user-agent') ?? null

  // Get hash of the last log entry for chain integrity
  const { data: lastEntry } = await supabase
    .from('audit_logs')
    .select('row_hash')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevHash = lastEntry?.row_hash ?? null

  // Compute this row's hash
  const rowContent = JSON.stringify({
    event_type:  payload.event_type,
    actor_id:    payload.actor_id,
    document_id: payload.document_id ?? null,
    revision_id: payload.revision_id ?? null,
    metadata:    payload.metadata ?? {},
    prev_hash:   prevHash,
    logged_at:   new Date().toISOString(),
  })
  const rowHash = await hashString(rowContent)

  await supabase.from('audit_logs').insert({
    event_type:  payload.event_type,
    actor_id:    payload.actor_id,
    document_id: payload.document_id ?? null,
    revision_id: payload.revision_id ?? null,
    ip_address:  ip,
    user_agent:  userAgent,
    metadata:    (payload.metadata ?? {}) as Json,
    prev_hash:   prevHash,
    row_hash:    rowHash,
  })
}
