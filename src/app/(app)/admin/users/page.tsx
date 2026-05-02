import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconUsers } from '@/components/ui/Icons'

export const metadata = { title: 'Users' }

const ROLE_STYLE: Record<string, string> = {
  admin:    'bg-accent/10 text-accent ring-accent/20',
  reviewer: 'bg-warning/10 text-warning ring-warning/20',
  editor:   'bg-success/10 text-success ring-success/20',
  viewer:   'bg-bg-inset text-ink-soft ring-line',
}

export default async function AdminUsersPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect non-admins. Defense-in-depth: middleware + this check.
  if ((user?.app_metadata?.role as string) !== 'admin') {
    redirect('/dashboard')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, department, role, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <div className="text-2xs uppercase tracking-wider text-ink-mute">Administration</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Users &amp; roles</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Role and department drive what each user can see and do via row-level security.
        </p>
      </div>

      <div className="surface overflow-hidden">
        {!profiles || profiles.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={20} />}
            title="No users yet"
            description="Create users in Supabase → Authentication → Users. They'll show up here."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Name</th>
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Department</th>
                <th className="px-5 py-3 text-left text-2xs uppercase tracking-wider font-semibold text-ink-mute">Role</th>
                <th className="px-5 py-3 text-right text-2xs uppercase tracking-wider font-semibold text-ink-mute">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {profiles.map((p: any) => (
                <tr key={p.id} className="hover:bg-bg-inset transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-7 items-center justify-center rounded-full bg-accent/20 text-accent text-2xs font-semibold">
                        {p.full_name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm text-ink">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-ink-soft">{p.department}</td>
                  <td className="px-5 py-3">
                    <span className={`chip ${ROLE_STYLE[p.role] ?? ROLE_STYLE.viewer}`}>{p.role}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-2xs text-ink-mute tabular-nums">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-2xs text-ink-mute">
        To change a user's role, update <code className="font-mono text-ink-soft">profiles.role</code> AND <code className="font-mono text-ink-soft">auth.users.raw_app_meta_data</code>.
        RLS reads from the JWT (app_metadata), not the profiles table.
      </p>
    </div>
  )
}
