import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { tokenService } from '@/lib/services/token-service'
import { otpService } from '@/lib/services/otp-service'
import { notificationService } from '@/lib/services/notification-service'

/**
 * API route to invite a coach by email
 * Creates auth user, profile, and coach record
 * Sends invite email with password setup link
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the requester is authenticated and is an admin
    const authResult = await requireAdmin(request)

    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { profile } = authResult

    if (!profile.club_id) {
      return NextResponse.json(
        { error: 'No club associated with your account' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, firstName, lastName, phone } = body

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, first name, and last name are required' },
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

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists
    const supabaseAdmin = createAdminClient()
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUser?.users?.some((u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail)

    if (userExists) {
      return NextResponse.json(
        { error: 'A user with this email already exists. If they need a new invitation, please delete their account first or have them use password reset.' },
        { status: 400 }
      )
    }

    // Step 1: Create auth user (without sending Supabase's native email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: false, // We'll confirm via OTP
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'coach',
        club_id: profile.club_id
      }
    })

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError)
      return NextResponse.json(
        { error: 'Failed to create coach auth user' },
        { status: 500 }
      )
    }

    const userId = authData.user.id

    // Step 2: Create/upsert profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName,
        role: 'coach',
        club_id: profile.club_id,
        email_verified_at: null // Will be set when they verify OTP
      }, {
        onConflict: 'id'
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to create coach profile' },
        { status: 500 }
      )
    }

    // Step 3: Coach record is automatically created by database trigger
    // The trigger 'trigger_ensure_coach_record_on_insert' on the profiles table
    // automatically creates a coach record when a profile with role='coach' is inserted.
    // No manual creation needed here!

    // Step 4: Generate secure setup token
    let setupToken: string
    try {
      setupToken = await tokenService.generateSetupToken({
        email: normalizedEmail,
        userId,
        type: 'admin_setup', // Use same type as admin for now
        clubId: profile.club_id,
        expiresInHours: 48
      })
    } catch (tokenError) {
      console.error('Error generating setup token:', tokenError)
      // Clean up
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      return NextResponse.json(
        { error: 'Failed to generate setup token' },
        { status: 500 }
      )
    }

    // Step 5: Generate OTP code
    const otpResult = await otpService.generate(
      userId,
      'admin_invitation', // Use same type as admin
      normalizedEmail
    )

    if (!otpResult.success || !otpResult.code) {
      console.error('Error generating OTP:', otpResult.error)
      // Clean up
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      return NextResponse.json(
        { error: 'Failed to generate verification code' },
        { status: 500 }
      )
    }

    // Step 6: Get club name for email
    const { data: clubData } = await supabaseAdmin
      .from('clubs')
      .select('name')
      .eq('id', profile.club_id)
      .single()

    const clubName = clubData?.name || 'Ski Club'

    // Step 7: Build secure setup link with token
    const setupLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`

    // Step 8: Send OTP via SendGrid
    const notificationResult = await notificationService.sendAdminInvitationOTP(
      normalizedEmail,
      otpResult.code,
      {
        firstName,
        clubName,
        setupLink,
        role: 'coach' // Specify this is a coach invitation
      }
    )

    if (!notificationResult.success) {
      console.error('Error sending invitation email:', notificationResult.error)
      // Don't fail the request - OTP is stored, they can try again
      return NextResponse.json({
        success: true,
        message: `Coach created but email failed to send. OTP code: ${otpResult.code} (save this!)`,
        warning: 'Email delivery failed',
        code: process.env.NODE_ENV === 'development' ? otpResult.code : undefined,
        coachId: userId
      })
    }

    // Success!
    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${normalizedEmail}`,
      coachId: userId,
      code: process.env.NODE_ENV === 'development' ? otpResult.code : undefined
    })
  } catch (error) {
    console.error('Error inviting coach:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    )
  }
}


