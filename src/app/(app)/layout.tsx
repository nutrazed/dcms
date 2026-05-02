import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, department')
    .eq('id', user.id)
    .maybeSingle()

  const userInfo = profile
    ? { fullName: profile.full_name, role: profile.role, department: profile.department }
    : { fullName: user.email ?? 'Unknown', role: 'viewer', department: '—' }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={userInfo} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
