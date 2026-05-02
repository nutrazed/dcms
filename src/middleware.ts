import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * DCMS Route Protection Middleware
 * Runs on Vercel Edge Runtime for global low-latency enforcement.
 * Protects all app routes, enforces role-based access gates,
 * and refreshes Supabase session cookies on every request.
 */

const ROLE_ROUTES: Record<string, string[]> = {
  '/admin':          ['admin'],
  '/documents/new':  ['editor', 'admin'],
  '/audit':          ['admin'],
  '/export':         ['admin'],
}

const PUBLIC_ROUTES = ['/', '/login', '/callback', '/403', '/404', '/_next', '/favicon']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const pathname = request.nextUrl.pathname

  // Skip middleware for public/static routes
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return response
  }

  // Skip middleware entirely if Supabase env vars are missing (dev-time fallback so the
  // app renders before the Supabase project is provisioned). In production these MUST
  // be set; the middleware will then fully enforce auth.
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session (extends sliding expiry)
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect unauthenticated users to login
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-gate protected routes
  const userRole = session.user.app_metadata?.role as string
  for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
      return NextResponse.redirect(new URL('/403', request.url))
    }
  }

  // Add role header for downstream Server Components (avoids duplicate JWT decode)
  response.headers.set('x-user-role',       userRole)
  response.headers.set('x-user-id',         session.user.id)
  response.headers.set('x-user-department', session.user.app_metadata?.department ?? '')

  return response
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
