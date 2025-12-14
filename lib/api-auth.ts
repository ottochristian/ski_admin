import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from './supabase-server'

export interface AuthenticatedRequest {
  user: {
    id: string
    email?: string
  }
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
}

/**
 * Middleware helper to require authentication for API routes.
 * Returns user and supabase client if authenticated, otherwise returns error response.
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireAuth(request)
 *   if (authResult instanceof NextResponse) {
 *     return authResult // Error response
 *   }
 *   const { user, supabase } = authResult
 *   // Use authenticated user...
 * }
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedRequest | NextResponse> {
  try {
    // Check for Bearer token in Authorization header first
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let supabase = await createServerSupabaseClient(request)
    
    // If we have a Bearer token, verify it using admin client
    if (token) {
      try {
        // Use admin client to verify the token (similar to system-admin route)
        const { createClient } = require('@supabase/supabase-js')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (supabaseUrl && serviceRoleKey) {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
          const {
            data: { user },
            error,
          } = await supabaseAdmin.auth.getUser(token)

          if (user && !error) {
            // Return with the regular supabase client (not admin) for subsequent queries
            return { user, supabase }
          }
        }
        // If token verification fails, fall through to cookie-based auth
      } catch (tokenError) {
        console.error('Token verification error:', tokenError)
        // Fall through to cookie-based auth
      }
    }

    // Try cookie-based authentication (default)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: error?.message || 'No user found',
        }, 
        { status: 401 }
      )
    }

    return { user, supabase }
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { 
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Middleware helper to require admin role.
 * Checks authentication AND verifies user has admin role.
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const authResult = await requireAdmin(request)
 *   if (authResult instanceof NextResponse) {
 *     return authResult
 *   }
 *   const { user, supabase, profile } = authResult
 *   // Use admin user...
 * }
 */
export async function requireAdmin(
  request: NextRequest
): Promise<
  | (AuthenticatedRequest & { profile: { role: string; club_id: string | null } })
  | NextResponse
> {
  const authResult = await requireAuth(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { user, supabase } = authResult

  // Get profile and check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    )
  }

  if (profile.role !== 'admin' && profile.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user, supabase, profile }
}

/**
 * Middleware helper to require system admin role.
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const authResult = await requireSystemAdmin(request)
 *   if (authResult instanceof NextResponse) {
 *     return authResult
 *   }
 *   // Use system admin...
 * }
 */
export async function requireSystemAdmin(
  request: NextRequest
): Promise<
  | (AuthenticatedRequest & { profile: { role: string } })
  | NextResponse
> {
  const authResult = await requireAdmin(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  if (authResult.profile.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return authResult
}

/**
 * Middleware helper to verify user belongs to a specific club.
 * Use this when operations are club-scoped.
 * 
 * @example
 * const clubId = request.nextUrl.searchParams.get('clubId')
 * const authResult = await requireClubAccess(request, clubId)
 */
export async function requireClubAccess(
  request: NextRequest,
  clubId: string | null
): Promise<
  | (AuthenticatedRequest & {
      profile: { role: string; club_id: string | null }
    })
  | NextResponse
> {
  const authResult = await requireAdmin(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  if (!clubId) {
    return NextResponse.json(
      { error: 'clubId is required' },
      { status: 400 }
    )
  }

  // System admins can access any club
  if (authResult.profile.role === 'system_admin') {
    return authResult
  }

  // Regular admins can only access their own club
  if (authResult.profile.club_id !== clubId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return authResult
}



