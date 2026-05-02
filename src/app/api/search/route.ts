import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { writeAuditLog } from '@/lib/actions/audit'

/**
 * DCMS Global Full-Text Search API
 * Runs on Vercel Edge Runtime for <50ms global response times.
 *
 * Strategy:
 * 1. PostgreSQL FTS via tsvector (GIN index, websearch syntax)
 * 2. ILIKE fallback for doc code partial matches (e.g. "QMS-POL")
 * Results are merged and deduplicated.
 */
export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q')?.trim()
  const area     = req.nextUrl.searchParams.get('area')   // Filter by functional area
  const status   = req.nextUrl.searchParams.get('status') // Filter by status
  const limit    = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '15'), 50)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Strategy 1: Full-text search (precise, GIN indexed)
  let ftsQuery = supabase
    .from('documents')
    .select('id, doc_code, title, status, functional_area, security_class, current_rev_id')
    .textSearch('fts_vector', q, { type: 'websearch', config: 'english' })
    .is('deleted_at', null)
    .limit(limit)

  if (area)   ftsQuery = ftsQuery.eq('functional_area', area)
  if (status) ftsQuery = ftsQuery.eq('status', status)

  // Strategy 2: ILIKE on doc_code (catches "QMS-POL-001" style queries)
  let ilikeQuery = supabase
    .from('documents')
    .select('id, doc_code, title, status, functional_area, security_class, current_rev_id')
    .ilike('doc_code', `%${q}%`)
    .is('deleted_at', null)
    .limit(Math.min(limit, 10))

  if (area)   ilikeQuery = ilikeQuery.eq('functional_area', area)
  if (status) ilikeQuery = ilikeQuery.eq('status', status)

  const [{ data: ftsResults }, { data: iLikeResults }] = await Promise.all([
    ftsQuery,
    ilikeQuery,
  ])

  // Merge + deduplicate by id, FTS results take priority
  const seen    = new Set<string>()
  const results = [...(ftsResults ?? []), ...(iLikeResults ?? [])]
    .filter((r) => !seen.has(r.id) && seen.add(r.id))

  // Log search event (for compliance audit trail)
  await writeAuditLog({
    event_type: 'global_search',
    actor_id:   user.id,
    metadata:   { query: q, result_count: results.length, area, status },
  })

  return NextResponse.json(
    { results, query: q, count: results.length },
    { headers: { 'Cache-Control': 'no-store, no-cache' } }
  )
}
