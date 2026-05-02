import Link from 'next/link'
import { IconArrowR, IconShield, IconActivity, IconFile } from '@/components/ui/Icons'

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[800px] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute top-1/3 right-0 size-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgb(var(--ink)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--ink)) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Top nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent text-white text-sm font-bold shadow-pop">
            D
          </div>
          <span className="text-sm font-semibold tracking-tight">DCMS</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/login" className="btn-primary">
            Open dashboard <IconArrowR size={14} />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-surface/60 backdrop-blur-sm px-3 py-1 text-xs text-ink-soft mb-8 animate-fade-in">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          ISO 9001:2015 · ISO 27001:2022 compliant
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] animate-slide-up">
          Document control,
          <br />
          <span className="bg-gradient-to-r from-accent via-accent-hover to-accent bg-clip-text text-transparent">
            without the chaos.
          </span>
        </h1>

        <p className="mt-6 mx-auto max-w-2xl text-lg text-ink-soft leading-relaxed animate-slide-up" style={{ animationDelay: '60ms' }}>
          A premium DCMS for regulated organizations. Versioning, approvals, audit trails,
          and full-text search — built on a tamper-evident audit chain and row-level security.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '120ms' }}>
          <Link href="/login" className="btn-primary text-base px-6 py-3">
            Get started <IconArrowR size={15} />
          </Link>
          <Link href="/dashboard" className="btn-secondary text-base px-6 py-3">
            View demo
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-ink-mute">
          Press <span className="kbd">⌘</span><span className="kbd">K</span> anywhere to search
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={<IconShield size={20} />}
            title="Tamper-evident audit"
            body="Every action chained via SHA-256 hashes. Detect a single byte modified in the audit log."
          />
          <Feature
            icon={<IconFile size={20} />}
            title="Semantic versioning"
            body="V1.0 to V2.0 for structural changes, V1.1 for fixes. Storage paths preserve every revision."
          />
          <Feature
            icon={<IconActivity size={20} />}
            title="Row-level security"
            body="Postgres RLS policies enforced per role and department. Defense in depth from the database up."
          />
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-6xl px-6 py-10 border-t border-line text-xs text-ink-mute flex items-center justify-between">
        <span>DCMS v2.0.0</span>
        <span className="font-mono">Next.js 15 · Supabase · Vercel Edge</span>
      </footer>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="surface p-6 hover:border-line-strong transition-colors">
      <div className="flex size-10 items-center justify-center rounded-md bg-accent/10 text-accent mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-ink mb-1.5">{title}</h3>
      <p className="text-sm text-ink-mute leading-relaxed">{body}</p>
    </div>
  )
}
