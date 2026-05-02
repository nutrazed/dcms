import Link from 'next/link'
import { IconShield, IconArrowR } from '@/components/ui/Icons'

export const metadata = { title: 'Access denied' }

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <IconShield size={20} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Access denied</h1>
        <p className="mt-2 text-sm text-ink-mute">
          Your role doesn't have permission to view this page. If you think this is a mistake,
          contact your DCMS administrator.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Back to dashboard <IconArrowR size={14} />
        </Link>
      </div>
    </main>
  )
}
