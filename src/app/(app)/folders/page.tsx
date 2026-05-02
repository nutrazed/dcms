import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconFolder, IconUpload } from '@/components/ui/Icons'

export const metadata = { title: 'Folders' }

export default async function FoldersPage() {
  const supabase = await createServerClient()

  const { data: folders } = await supabase
    .from('folders')
    .select('id, name, path, functional_area, owner_dept, created_at')
    .order('functional_area', { ascending: true })

  // Count documents per folder
  const counts: Record<string, number> = {}
  if (folders && folders.length > 0) {
    const folderIds = folders.map((f: any) => f.id)
    const { data: docs } = await supabase
      .from('documents')
      .select('folder_id')
      .in('folder_id', folderIds)
      .is('deleted_at', null)

    for (const d of docs ?? []) {
      counts[(d as any).folder_id] = (counts[(d as any).folder_id] ?? 0) + 1
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-mute">Hierarchy</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Folders</h1>
          <p className="mt-1 text-sm text-ink-mute">Folders are auto-created per functional area on first upload.</p>
        </div>
        <Link href="/documents/new" className="btn-primary">
          <IconUpload size={14} /> New document
        </Link>
      </div>

      {!folders || folders.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<IconFolder size={20} />}
            title="No folders yet"
            description="Folders are created automatically when you upload your first document in a functional area."
            action={
              <Link href="/documents/new" className="btn-primary">
                <IconUpload size={14} /> Upload document
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {folders.map((f: any) => (
            <Link
              key={f.id}
              href={`/documents?area=${encodeURIComponent(f.functional_area)}`}
              className="surface p-5 hover:border-line-strong transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-accent/10 text-accent shrink-0">
                  <IconFolder size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors">
                    {f.name}
                  </div>
                  <div className="mt-0.5 text-2xs text-ink-mute font-mono truncate">{f.path}</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line text-2xs text-ink-mute flex items-center justify-between">
                <span>{counts[f.id] ?? 0} document{counts[f.id] === 1 ? '' : 's'}</span>
                <span>{f.owner_dept}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
