import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * OAuth / magic-link callback. Supabase redirects here after auth;
 * we exchange the `code` query param for a session cookie and bounce
 * the user to either `?next=` or the dashboard.
 */
export async function GET(request: Request) {
  const url  = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
