import { NextRequest, NextResponse } from 'next/server'
import { tokenService } from '@/lib/services/token-service'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, password, token } = body

    if (!userId || !password || !token) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, password, token' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 12) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters' },
        { status: 400 }
      )
    }

    // Verify the token one more time (double-check)
    const verification = await tokenService.verifySetupToken(token)

    if (!verification.valid || !verification.payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const { jti, userId: tokenUserId, email } = verification.payload

    // Ensure userId matches token
    if (tokenUserId !== userId) {
      return NextResponse.json(
        { error: 'Token mismatch' },
        { status: 401 }
      )
    }

    const supabaseAdmin = createAdminClient()

    // Check if token already used
    const isUsed = await tokenService.isTokenUsed(jti, supabaseAdmin)

    if (isUsed) {
      return NextResponse.json(
        { error: 'Token has already been used' },
        { status: 401 }
      )
    }

    // Mark token as used BEFORE setting password (prevent race conditions)
    await tokenService.markTokenAsUsed({
      jti,
      userId,
      type: 'admin_setup',
      supabaseAdmin
    })

    // Set the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password }
    )

    if (updateError) {
      console.error('Error setting password:', updateError)
      return NextResponse.json(
        { error: 'Failed to set password' },
        { status: 500 }
      )
    }

    // Update user metadata to mark invitation as complete
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        invitation_pending: false,
        invitation_completed_at: new Date().toISOString(),
        setup_completed_via_token: jti
      }
    })

    // Update profile to mark email as verified
    await supabaseAdmin
      .from('profiles')
      .update({ email_verified_at: new Date().toISOString() })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      message: 'Password set successfully'
    })
  } catch (error) {
    console.error('Setup password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
