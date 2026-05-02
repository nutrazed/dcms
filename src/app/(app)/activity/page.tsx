import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconActivity } from '@/components/ui/Icons'

export const metadata = { title: 'Activity' }

const VERB: Record<string, string> = {
  document_created:     'created',
  revision_uploaded:    'uploaded a new revision of',
  submitted_for_review: 'submitted for review',
  document_approved:    'approved',
  document_rejected:    'rejected a revision of',
  document_obsoleted:   'retired',
  global_search:        'searched',
}

export default async function ActivityPage() {
  const supabase = await createServerClient()

  const { data: events } = await supabase
    .from('audit_logs')
    .select('id, event_type, actor_id, document_id, logged_at, metadata')
    .order('logged_at', { ascending: false })
    .limit(100)

  // Resolve actor names + doc codes
  const actorIds = Array.from(new Set((events ?? []).map((e: any) => e.actor_id).filter(Boolean)))
  const docIds   = Array.from(new Set((events ?? []).map((e: any) => e.document_id).filter(Boolean)))

  const [{ data: actors }, { data: docs }] = await Promise.all([
    actorIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    docIds.length
      ? supabase.from('documents').select('id, doc_code, title').in('id', docIds)
      : Promise.resolve({ data: [] }),
  ])

  const actorMap = new Map((actors ?? []).map((a: any) => [a.id, a.full_name]))
  const docMap = new Map((docs ?? []).map((d: any) => [d.id, d]))

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="text-2xs uppercase tracking-wider text-ink-mute">Audit trail</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Activity</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Hash-chained audit log. Every event is signed against the previous to detect tampering.
        </p>
      </div>

      <div className="surface overflow-hidden">
        {!events || events.length === 0 ? (
          <EmptyState
            icon={<IconActivity size={20} />}
            title="No activity yet"
            description="As documents are created, edited, and approved, every event is recorded here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {events.map((event: any) => {
              const actor = actorMap.get(event.actor_id) ?? 'A user'
              const doc = event.document_id ? docMap.get(event.document_id) : null
              const verb = VERB[event.event_type] ?? event.event_type

              return (
                <li key={event.id} className="px-5 py-4 hover:bg-bg-inset transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink">
                        <span className="font-medium">{actor}</span>{' '}
                        <span className="text-ink-soft">{verb}</span>
                        {doc && (
                          <>
                            {' '}
                            <Link href={`/documents/${(doc as any).id}`} className="text-accent hover:underline">
                              <span className="font-mono text-xs">{(doc as any).doc_code}</span>
                            </Link>
                            <span className="text-ink-soft"> — {(doc as any).title}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-2xs text-ink-mute">
                        {new Date(event.logged_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
