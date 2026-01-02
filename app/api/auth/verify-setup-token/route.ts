import { NextRequest, NextResponse } from 'next/server'
import { tokenService } from '@/lib/services/token-service'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Verify the token signature and expiration
    const verification = await tokenService.verifySetupToken(token)

    if (!verification.valid || !verification.payload) {
      return NextResponse.json(
        { 
          success: false,
          error: verification.error || 'Invalid token'
        },
        { status: 401 }
      )
    }

    const { jti, userId, email, type, clubId } = verification.payload

    // Check if token has been used (replay attack prevention)
    const supabaseAdmin = createAdminClient()
    const isUsed = await tokenService.isTokenUsed(jti, supabaseAdmin)

    if (isUsed) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Token has already been used'
        },
        { status: 401 }
      )
    }

    // Verify user still exists and hasn't completed setup
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (userError || !userData.user) {
      return NextResponse.json(
        { 
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // Check if user has already completed setup (has email_verified_at)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email_verified_at, role, club_id')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Profile not found'
        },
        { status: 404 }
      )
    }

    // If setup already completed, token is no longer valid
    if (profile.email_verified_at) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Setup already completed. Please log in.'
        },
        { status: 400 }
      )
    }

    // Token is valid and not used - return user info
    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        type,
        clubId,
        role: profile.role
      }
    })
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
