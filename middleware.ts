import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

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

  // Update session and get user (automatically handles cookie refresh)
  const { user, supabaseResponse } = await updateSession(request)

  // Only check auth for protected routes
  if (!isPublicRoute) {
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
      if (!user) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // Note: For full role-based access control, we'd need to query the database here
      // However, middleware should be kept lightweight for performance
      // We'll rely on page-level checks for detailed role validation
      // The session refresh from updateSession() is the main security boundary
    }
  }

  return supabaseResponse
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

