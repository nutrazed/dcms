'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import {
  IconHome, IconFile, IconUpload, IconUsers, IconFolder, IconActivity,
} from '@/components/ui/Icons'

type NavItem = { href: string; label: string; icon: React.ComponentType<any>; adminOnly?: boolean }

const NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard', icon: IconHome },
  { href: '/documents',     label: 'Register',  icon: IconFile },
  { href: '/documents/new', label: 'New',       icon: IconUpload },
  { href: '/folders',       label: 'Folders',   icon: IconFolder },
  { href: '/activity',      label: 'Activity',  icon: IconActivity },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/users', label: 'Users', icon: IconUsers, adminOnly: true },
]

export function Sidebar({ user }: { user: { fullName: string; role: string; department: string } | null }) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line bg-bg-surface">
      {/* Brand */}
      <div className="px-4 pt-5 pb-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent text-white text-sm font-bold shadow-pop">
            D
          </div>
          <div>
            <div className="text-sm font-semibold text-ink leading-none">DCMS</div>
            <div className="text-2xs text-ink-mute mt-0.5">v2.0 · ISO 9001</div>
          </div>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <div className="text-2xs font-semibold uppercase tracking-wider text-ink-faint px-2.5 py-2">
          Workspace
        </div>
        {NAV.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-link', active && 'nav-link-active')}
            >
              <Icon size={15} className="text-ink-mute" />
              {item.label}
            </Link>
          )
        })}

        {user?.role === 'admin' && (
          <>
            <div className="text-2xs font-semibold uppercase tracking-wider text-ink-faint px-2.5 py-2 mt-4">
              Administration
            </div>
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('nav-link', active && 'nav-link-active')}
                >
                  <Icon size={15} className="text-ink-mute" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User card */}
      {user && (
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-md bg-bg-inset px-2.5 py-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-accent/20 text-accent text-2xs font-semibold">
              {user.fullName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-ink truncate">{user.fullName}</div>
              <div className="text-2xs text-ink-mute truncate">
                {user.role} · {user.department}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
