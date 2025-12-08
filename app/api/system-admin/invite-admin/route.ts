import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This route requires service role key for admin operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase admin client
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (configError) {
      console.error('Supabase configuration error:', configError)
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: configError instanceof Error ? configError.message : 'Missing environment variables'
        },
        { status: 500 }
      )
    }

    // Verify the requester is a system admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is system admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, firstName, lastName, clubId } = body

    if (!email || !clubId) {
      return NextResponse.json(
        { error: 'Email and clubId are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Build redirect URL - must be a valid absolute URL
    // For localhost, use http://localhost:3000
    // For production, use your actual domain
    let redirectTo: string
    if (process.env.NEXT_PUBLIC_APP_URL) {
      redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/login`
    } else {
      // Default to localhost for development
      redirectTo = 'http://localhost:3000/login'
    }

    console.log('Inviting user:', { email, redirectTo })

    // Invite user by email
    // Note: redirectTo must be added to allowed redirect URLs in Supabase dashboard
    // Go to: Authentication → URL Configuration → Redirect URLs
    // If you get "string did not match pattern" error, try:
    // 1. Add the redirectTo URL to allowed redirect URLs in Supabase dashboard
    // 2. Or remove redirectTo parameter (user will be redirected to default)
    let inviteOptions: { redirectTo?: string } = {}
    
    // Only include redirectTo if we have a valid URL
    if (redirectTo && redirectTo.startsWith('http')) {
      inviteOptions.redirectTo = redirectTo
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      inviteOptions
    )

    if (inviteError) {
      console.error('Invite error details:', {
        message: inviteError.message,
        status: inviteError.status,
        name: inviteError.name,
        fullError: JSON.stringify(inviteError, null, 2),
      })
      return NextResponse.json(
        { 
          error: inviteError.message || 'Failed to send invitation',
          details: inviteError,
          hint: inviteError.message?.includes('pattern') 
            ? 'Check that redirectTo URL is valid and added to allowed redirect URLs in Supabase dashboard'
            : undefined
        },
        { status: 400 }
      )
    }

    // Create profile for invited user and update user metadata
    if (inviteData.user) {
      // Update user metadata with admin info
      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
        inviteData.user.id,
        {
          user_metadata: {
            first_name: firstName || null,
            last_name: lastName || null,
            role: 'admin',
            club_id: clubId,
          },
        }
      )

      if (metadataError) {
        console.error('Error updating user metadata:', metadataError)
      }

      // Create profile
      const { error: profileError } = await supabaseAdmin.rpc('create_user_profile', {
        p_user_id: inviteData.user.id,
        p_email: email,
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_role: 'admin',
        p_club_id: clubId,
      })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Don't fail the request - profile might be created by trigger
      }
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
    })
  } catch (error) {
    console.error('Error inviting admin:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    )
  }
}
