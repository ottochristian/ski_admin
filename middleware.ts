import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Enhanced middleware with role-based route protection
 * Handles authentication and authorization at the route level
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow public routes
  const publicRoutes = [
    '/', // Root route - home page handles its own auth logic
    '/login',
    '/signup',
    '/api/health',
    '/api/webhooks', // Webhooks need to be public (authenticated via signatures)
    '/setup-password', // Password setup page
  ]

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  )

  // Allow static assets and Next.js internals
  // CRITICAL: Skip middleware for static assets to improve performance
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/_next') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|json)$/)
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

  // Redirect legacy admin routes to club-aware routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/clubs/')) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Get user's club slug
      const { data: profile } = await supabase
        .from('profiles')
        .select('club_id')
        .eq('id', user.id)
        .single()

      if (profile?.club_id) {
        // Get club slug
        const { data: club } = await supabase
          .from('clubs')
          .select('slug')
          .eq('id', profile.club_id)
          .single()

        if (club?.slug) {
          // Redirect to club-aware admin route
          const newPath = pathname.replace('/admin', `/clubs/${club.slug}/admin`)
          return NextResponse.redirect(new URL(newPath, request.url))
        }
      }
    }
  }

  // Only check auth for protected routes
  if (!isPublicRoute) {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // Define role-based route patterns
    const adminRoutes = ['/admin', '/clubs']
    const systemAdminRoutes = ['/system-admin']
    const coachRoutes = ['/coach']
    const parentRoutes = ['/clubs']

    // Check if admin route (legacy or club-aware)
    const isAdminRoute = pathname.startsWith('/admin') || pathname.match(/^\/clubs\/[^/]+\/admin/)
    const isSystemAdminRoute = systemAdminRoutes.some((route) =>
      pathname.startsWith(route)
    )
    const isCoachRoute = coachRoutes.some((route) => pathname.startsWith(route))
    const isParentRoute = parentRoutes.some((route) => pathname.startsWith(route))

    const isProtectedRoute =
      isAdminRoute || isSystemAdminRoute || isCoachRoute || isParentRoute

    // If accessing a protected route, check authentication
    if (isProtectedRoute) {
      if (!user || authError) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // Get user profile to check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // Role-based access control
      if (isSystemAdminRoute && profile?.role !== 'system_admin') {
        // System admin routes - only system_admin role
        const redirectUrl = new URL('/', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      if (isAdminRoute && profile?.role !== 'admin' && profile?.role !== 'system_admin') {
        // Admin routes - admin or system_admin role
        const redirectUrl = new URL('/', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      if (isCoachRoute && profile?.role !== 'coach') {
        // Coach routes - coach role only
        const redirectUrl = new URL('/', request.url)
        return NextResponse.redirect(redirectUrl)
      }

      if (isParentRoute && profile?.role !== 'parent') {
        // Parent routes - parent role only
        const redirectUrl = new URL('/', request.url)
        return NextResponse.redirect(redirectUrl)
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

