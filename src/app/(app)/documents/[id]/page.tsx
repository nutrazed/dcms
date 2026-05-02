import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { StatusChip, type DocStatus } from '@/components/ui/StatusChip'
import { DocumentActions } from '@/components/documents/DocumentActions'
import { IconFile, IconArrowR, IconShield, IconClock, IconActivity } from '@/components/ui/Icons'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}

export default async function DocumentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const justCreated = sp.created === '1'

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Document + owner profile
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !doc) notFound()

  const [
    { data: revisions },
    { data: ownerProfile },
    { data: auditLogs },
  ] = await Promise.all([
    supabase
      .from('revisions')
      .select('id, major, minor, version_label, file_hash, change_summary, authored_by, approved_by, approved_at, created_at')
      .eq('document_id', id)
      .order('created_at', { ascending: false }),
    doc.owner_id
      ? supabase.from('profiles').select('full_name, department').eq('id', doc.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('audit_logs')
      .select('id, event_type, actor_id, logged_at, metadata')
      .eq('document_id', id)
      .order('logged_at', { ascending: false })
      .limit(20),
  ])

  const role = (user?.app_metadata?.role ?? 'viewer') as string
  const isOwner = doc.owner_id === user?.id

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {justCreated && (
        <div className="mb-6 rounded-md bg-success/10 border border-success/20 px-4 py-2.5 text-sm text-success animate-fade-in">
          ✓ Document created. It's now in <span className="font-semibold">draft</span> status — submit for review when ready.
        </div>
      )}

      {/* Breadcrumb */}
      <div className="text-2xs text-ink-mute mb-3">
        <Link href="/documents" className="hover:text-accent">Documents</Link>
        <span className="mx-1.5">/</span>
        <span className="font-mono">{doc.doc_code}</span>
      </div>

      {/* Header */}
      <div className="surface p-6 mb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-2xs text-ink-mute">{doc.doc_code}</span>
              <span className="text-2xs text-ink-mute">·</span>
              <StatusChip status={doc.status as DocStatus} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink leading-tight">{doc.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-mute">
              <span className="capitalize">{doc.doc_type.replace('_', ' ')}</span>
              <span>·</span>
              <span>{doc.functional_area}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <IconShield size={11} /> {doc.security_class}
              </span>
              {ownerProfile && (
                <>
                  <span>·</span>
                  <span>Owned by {ownerProfile.full_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-line">
          <DocumentActions
            documentId={doc.id}
            currentRevisionId={doc.current_rev_id}
            status={doc.status}
            isOwner={isOwner}
            role={role}
          />
        </div>
      </div>

      {/* Two-col grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revisions (2 cols) */}
        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <IconFile size={14} className="text-ink-mute" />
            Version history
            <span className="text-2xs text-ink-mute font-normal">
              {revisions?.length ?? 0} revision{revisions?.length === 1 ? '' : 's'}
            </span>
          </h2>
          <div className="surface overflow-hidden">
            {!revisions || revisions.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-mute">No revisions yet.</div>
            ) : (
              <ul className="divide-y divide-line">
                {revisions.map((rev: any, i: number) => (
                  <li key={rev.id} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="font-mono text-sm font-semibold text-accent shrink-0 w-12">{rev.version_label}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-ink">{rev.change_summary}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-mute">
                          <span>{new Date(rev.created_at).toLocaleString()}</span>
                          {rev.approved_at && (
                            <>
                              <span className="text-success">✓ Approved</span>
                              <span>{new Date(rev.approved_at).toLocaleDateString()}</span>
                            </>
                          )}
                          <span className="font-mono opacity-60">SHA: {rev.file_hash.slice(0, 12)}…</span>
                        </div>
                      </div>
                      {i === 0 && (
                        <span className="chip bg-accent/10 text-accent ring-accent/20 shrink-0">Current</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Metadata + audit feed */}
        <aside className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-ink mb-3">Properties</h2>
            <div className="surface divide-y divide-line">
              <Prop label="Effective" value={doc.effective_date ?? '—'} />
              <Prop label="Review due" value={doc.review_due_date ?? '—'} />
              <Prop label="Retention" value={`${doc.retention_years} years`} />
              <Prop label="Standards" value={doc.applicable_standards?.join(', ') || '—'} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
              <IconActivity size={14} className="text-ink-mute" /> Audit trail
            </h2>
            <div className="surface p-2">
              {!auditLogs || auditLogs.length === 0 ? (
                <div className="px-3 py-4 text-2xs text-ink-mute">No events yet.</div>
              ) : (
                <ul className="space-y-0.5">
                  {auditLogs.map((event: any) => (
                    <li key={event.id} className="px-3 py-2 rounded-md hover:bg-bg-inset">
                      <div className="flex items-start gap-2">
                        <div className="mt-1 size-1.5 rounded-full bg-accent shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-2xs text-ink">{(event.event_type as string).replace(/_/g, ' ')}</div>
                          <div className="text-2xs text-ink-mute mt-0.5">
                            {new Date(event.logged_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Prop({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
      <span className="text-2xs uppercase tracking-wider text-ink-mute">{label}</span>
      <span className="text-xs text-ink text-right truncate">{value}</span>
    </div>
  )
}
