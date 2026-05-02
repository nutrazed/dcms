import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { StatusChip, type DocStatus } from '@/components/ui/StatusChip'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  IconFile, IconClock, IconCheck, IconAlert, IconArrowR, IconActivity, IconUpload,
} from '@/components/ui/Icons'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createServerClient()

  // Pull stats in parallel for speed
  const [
    { count: activeCount },
    { count: pendingCount },
    { count: approvedThisWeek },
    { count: dueSoonCount },
    { data: recentActivity },
    { data: recentDocs },
  ] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'under_review').is('deleted_at', null),
    supabase
      .from('revisions')
      .select('*', { count: 'exact', head: true })
      .gte('approved_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .not('approved_at', 'is', null),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .lte('review_due_date', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .eq('status', 'approved')
      .is('deleted_at', null),
    supabase
      .from('audit_logs')
      .select('id, event_type, logged_at, document_id, metadata')
      .order('logged_at', { ascending: false })
      .limit(8),
    supabase
      .from('documents')
      .select('id, doc_code, title, status, functional_area, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(6),
  ])

  const tiles = [
    { label: 'Active documents',   value: activeCount ?? 0,      icon: IconFile,     accent: 'text-accent' },
    { label: 'Pending review',     value: pendingCount ?? 0,     icon: IconClock,    accent: 'text-warning' },
    { label: 'Approved (7d)',      value: approvedThisWeek ?? 0, icon: IconCheck,    accent: 'text-success' },
    { label: 'Up for review (30d)', value: dueSoonCount ?? 0,    icon: IconAlert,    accent: 'text-danger' },
  ]

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-mute">Overview</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
        </div>
        <Link href="/documents/new" className="btn-primary">
          <IconUpload size={14} /> New revision
        </Link>
      </div>

      {/* Stat tiles */}
      <section className="grid gap-4 md:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="surface p-5 hover:border-line-strong transition-colors">
            <div className="flex items-start justify-between">
              <div className="text-2xs uppercase tracking-wider text-ink-mute">{label}</div>
              <Icon size={16} className={accent} />
            </div>
            <div className="mt-3 text-3xl font-bold tabular-nums text-ink tracking-tight">{value}</div>
          </div>
        ))}
      </section>

      {/* Recent docs + activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Recent documents (2 cols) */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink">Recent documents</h2>
            <Link href="/documents" className="text-xs text-ink-mute hover:text-accent flex items-center gap-1">
              View all <IconArrowR size={12} />
            </Link>
          </div>
          <div className="surface overflow-hidden">
            {!recentDocs || recentDocs.length === 0 ? (
              <EmptyState
                icon={<IconFile size={20} />}
                title="No documents yet"
                description="Upload your first document to populate the register."
                action={
                  <Link href="/documents/new" className="btn-primary">
                    <IconUpload size={14} /> Upload first document
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentDocs.map((doc: any) => (
                  <li key={doc.id}>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-bg-inset transition-colors"
                    >
                      <span className="font-mono text-2xs text-ink-mute shrink-0 w-32 truncate">{doc.doc_code}</span>
                      <span className="text-sm text-ink truncate flex-1">{doc.title}</span>
                      <span className="text-2xs text-ink-mute shrink-0">{doc.functional_area}</span>
                      <StatusChip status={doc.status as DocStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Activity feed */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink">Activity</h2>
            <IconActivity size={14} className="text-ink-mute" />
          </div>
          <div className="surface p-2">
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-ink-mute">No activity yet.</div>
            ) : (
              <ul className="space-y-0.5">
                {recentActivity.map((event: any) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ActivityRow({ event }: { event: any }) {
  const verb = ACTIVITY_VERB[event.event_type as string] ?? event.event_type
  const time = new Date(event.logged_at)
  const ago = relTime(time)

  return (
    <li className="px-3 py-2 rounded-md hover:bg-bg-inset">
      <div className="flex items-start gap-2">
        <div className="mt-1 size-1.5 rounded-full bg-accent shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-ink truncate">{verb}</div>
          <div className="text-2xs text-ink-mute mt-0.5">{ago}</div>
        </div>
      </div>
    </li>
  )
}

const ACTIVITY_VERB: Record<string, string> = {
  document_created:     'Document created',
  revision_uploaded:    'New revision uploaded',
  submitted_for_review: 'Submitted for review',
  document_approved:    'Document approved',
  document_rejected:    'Revision rejected',
  document_obsoleted:   'Document obsoleted',
  global_search:        'Global search performed',
}

function relTime(d: Date): string {
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}
