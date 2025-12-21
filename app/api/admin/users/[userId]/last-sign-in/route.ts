import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API route to get user's last sign-in time
 * Uses service role to access auth.users data
 * Only accessible to system admins
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // In Next.js 15+, params is a Promise that must be awaited
    const { userId } = await params
    console.log('[last-sign-in] Starting request for userId:', userId)
    console.log('[last-sign-in] Has SUPABASE_URL?', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('[last-sign-in] Has SERVICE_ROLE_KEY?', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('[last-sign-in] Supabase admin client created')

    // Verify the requesting user is a system admin
    const authHeader = request.headers.get('authorization')
    console.log('[last-sign-in] Has auth header?', !!authHeader)
    
    if (!authHeader) {
      console.log('[last-sign-in] No auth header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('[last-sign-in] Getting user from token...')
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.log('[last-sign-in] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[last-sign-in] User authenticated:', user.id)

    // Check if user is system admin
    console.log('[last-sign-in] Checking user role...')
    
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('[last-sign-in] User role:', profile?.role)

    if (profile?.role !== 'system_admin') {
      console.log('[last-sign-in] User is not system admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the target user's auth data
    console.log('[last-sign-in] Getting user by ID:', userId)
    
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      userId
    )

    if (userError) {
      console.log('[last-sign-in] Error getting user:', userError)
      return NextResponse.json(
        { error: userError.message },
        { status: 500 }
      )
    }

    console.log('[last-sign-in] Success! last_sign_in_at:', userData.user.last_sign_in_at)

    return NextResponse.json({
      last_sign_in_at: userData.user.last_sign_in_at
    })
  } catch (error) {
    console.error('[last-sign-in] Catch block error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
