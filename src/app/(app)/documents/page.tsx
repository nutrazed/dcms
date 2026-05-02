import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { StatusChip, type DocStatus } from '@/components/ui/StatusChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconFile, IconUpload, IconSearch } from '@/components/ui/Icons'

export const metadata = { title: 'Documents' }

const AREAS = ['QMS', 'OPS', 'HR', 'FIN', 'IT'] as const
const STATUSES: DocStatus[] = ['draft', 'under_review', 'approved', 'obsolete']

interface PageProps {
  searchParams: Promise<{ q?: string; area?: string; status?: string }>
}

export default async function DocumentsRegisterPage({ searchParams }: PageProps) {
  const params = await searchParams
  const q       = params.q?.trim() || ''
  const area    = params.area || ''
  const status  = params.status || ''

  const supabase = await createServerClient()

  let query = supabase
    .from('documents')
    .select('id, doc_code, title, doc_type, functional_area, status, current_rev_id, updated_at, security_class')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (area)   query = query.eq('functional_area', area)
  if (status) query = query.eq('status', status)
  if (q)      query = query.or(`title.ilike.%${q}%,doc_code.ilike.%${q}%`)

  const { data: docs, error } = await query

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-mute">Controlled register</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Documents</h1>
          <p className="mt-1 text-sm text-ink-mute">
            {docs?.length ?? 0} document{(docs?.length ?? 0) === 1 ? '' : 's'} matching filters
          </p>
        </div>
        <Link href="/documents/new" className="btn-primary">
          <IconUpload size={14} /> New revision
        </Link>
      </div>

      {/* Filters bar — uses GET form so URL drives state, fully server-rendered */}
      <form className="surface p-3 mb-4 flex flex-wrap items-center gap-2" method="GET">
        <div className="relative flex-1 min-w-[240px]">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title or doc code…"
            className="input pl-9"
          />
        </div>
        <select name="area" defaultValue={area} className="input w-32">
          <option value="">All areas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select name="status" defaultValue={status} className="input w-40">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <button type="submit" className="btn-primary">Apply</button>
        {(q || area || status) && (
          <Link href="/documents" className="btn-ghost">Clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="surface overflow-hidden">
        {error && (
          <div className="px-5 py-4 text-sm text-danger">
            Error loading documents: {error.message}
          </div>
        )}

        {!error && (!docs || docs.length === 0) && (
          <EmptyState
            icon={<IconFile size={20} />}
            title={q || area || status ? 'No matching documents' : 'No documents yet'}
            description={q || area || status
              ? 'Try clearing some filters, or create a new document.'
              : 'Get started by uploading the first document to your register.'}
            action={
              <Link href="/documents/new" className="btn-primary">
                <IconUpload size={14} /> Upload first document
              </Link>
            }
          />
        )}

        {!error && docs && docs.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Code</th>
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Title</th>
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Type</th>
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Area</th>
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Status</th>
                <th className="px-5 py-3 text-right text-2xs uppercase tracking-wider font-semibold text-ink-mute">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {docs.map((d: any) => (
                <tr key={d.id} className="group hover:bg-bg-inset transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/documents/${d.id}`} className="font-mono text-xs text-accent group-hover:underline">
                      {d.doc_code}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/documents/${d.id}`} className="text-sm text-ink hover:text-accent">
                      {d.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-ink-soft capitalize">{d.doc_type.replace('_', ' ')}</td>
                  <td className="px-5 py-3 text-sm text-ink-soft">{d.functional_area}</td>
                  <td className="px-5 py-3"><StatusChip status={d.status as DocStatus} /></td>
                  <td className="px-5 py-3 text-right text-2xs text-ink-mute tabular-nums">
                    {new Date(d.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
