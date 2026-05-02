import { createServerClient } from '@/lib/supabase/server'
import { UploadForm } from '@/components/upload/UploadForm'

export const metadata = { title: 'New document' }

export default async function NewDocumentPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const department = user?.app_metadata?.department as string | undefined

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="text-2xs uppercase tracking-wider text-ink-mute">Authoring</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">New document</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Upload the first revision (V1.0) of a controlled document. A unique doc code will be assigned automatically.
        </p>
      </div>

      <div className="surface p-6">
        <UploadForm defaultArea={department} />
      </div>

      <div className="mt-4 text-2xs text-ink-mute leading-relaxed">
        Files are stored privately. The system computes a SHA-256 hash for tamper detection
        and writes a chained audit log entry. Documents start in <span className="text-ink-soft">draft</span> status —
        submit for review when ready.
      </div>
    </div>
  )
}
