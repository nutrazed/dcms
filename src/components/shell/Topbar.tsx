'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { IconSearch, IconLogout } from '@/components/ui/Icons'
import { StatusChip, type DocStatus } from '@/components/ui/StatusChip'

interface SearchHit {
  id: string
  doc_code: string
  title: string
  status: DocStatus
  functional_area: string
}

export function Topbar() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl-K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Debounced search
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results ?? [])
          setOpen(true)
        }
      } catch {
        // swallow — show no results
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg-base/80 backdrop-blur-md px-6">
      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <div className="relative">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q.length >= 2 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search documents, codes, titles…"
            className="w-full bg-bg-inset border border-line rounded-md pl-9 pr-16 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-0.5">
            <span className="kbd">⌘</span><span className="kbd">K</span>
          </span>
        </div>

        {/* Results dropdown */}
        {open && (
          <div className="absolute left-0 right-0 mt-2 surface-elev shadow-pop z-30 max-h-96 overflow-y-auto animate-slide-up">
            {loading && (
              <div className="px-4 py-3 text-xs text-ink-mute">Searching…</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-4 py-3 text-xs text-ink-mute">No matches.</div>
            )}
            {!loading && results.length > 0 && (
              <ul className="py-1">
                {results.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/documents/${r.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setOpen(false); setQ('') }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-inset transition-colors"
                    >
                      <span className="font-mono text-2xs text-ink-mute shrink-0 w-32">{r.doc_code}</span>
                      <span className="text-sm text-ink truncate flex-1">{r.title}</span>
                      <StatusChip status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSignOut}
          className="btn-ghost"
          title="Sign out"
        >
          <IconLogout size={15} />
          <span className="hidden md:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
