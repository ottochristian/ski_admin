import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow public routes
  const publicRoutes = [
    '/', // Root route - home page handles its own auth logic
    '/login',
    '/signup',
    '/api/health',
    '/api/webhooks', // Webhooks need to be public (authenticated via signatures)
  ]

  const isPublicRoute = publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(route)
  )

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/_next') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next()
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Only check auth for protected routes (skip for public routes and static assets)
  if (!isPublicRoute) {
    // Refresh session if expired (important for SSR)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Protect authenticated routes
    const protectedRoutes = [
      '/admin',
      '/dashboard',
      '/coach',
      '/system-admin',
      '/clubs', // Club routes need auth
    ]

    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route)
    )

    if (isProtectedRoute) {
      if (!user) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled individually)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (handled in middleware logic, not in matcher)
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico).*)',
  ],
}

