import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { otpService } from '@/lib/services/otp-service'
import { notificationService } from '@/lib/services/notification-service'
import { tokenService } from '@/lib/services/token-service'

// This route requires service role key for admin operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
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

    // Check if user already exists in profiles (case-insensitive)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'A user with this email already exists. Please use a different email or delete the existing user first.' },
        { status: 400 }
      )
    }

    console.log('Creating admin invitation for:', email)

    // Step 1: Create user in auth.users (without password - they'll set it later)
    // Note: Supabase auth automatically lowercases emails
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),  // Explicitly lowercase to match auth.users behavior
      email_confirm: true,  // Mark email as confirmed (they'll verify with OTP)
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
        role: 'admin',
        club_id: clubId,
        invitation_pending: true  // Flag to track invitation status
      }
    })

    if (createUserError || !newUser.user) {
      console.error('Error creating user:', createUserError)
      return NextResponse.json(
        { error: createUserError?.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    const userId = newUser.user.id

    // Step 2: Create profile (lowercase email to match auth.users)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email.toLowerCase(),  // Match auth.users lowercase format
        first_name: firstName || null,
        last_name: lastName || null,
        role: 'admin',
        club_id: clubId,
        email_verified_at: null  // Will be set when they verify OTP
      }, {
        onConflict: 'id'
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { 
          error: 'Failed to create admin profile',
          details: profileError.message
        },
        { status: 500 }
      )
    }

    // Step 3: Get club name for email
    const { data: clubData } = await supabaseAdmin
      .from('clubs')
      .select('name')
      .eq('id', clubId)
      .single()

    const clubName = clubData?.name || 'Ski Admin'

    // Step 4: Generate secure setup token (prevents unauthorized access)
    let setupToken: string
    try {
      setupToken = await tokenService.generateSetupToken({
        email,
        userId,
        type: 'admin_setup',
        clubId,
        expiresInHours: 48 // 48 hours to complete setup
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
      'admin_invitation',
      email
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

    // Step 6: Build secure setup link with token
    const setupLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`

    // Step 7: Send OTP via email
    const notificationResult = await notificationService.sendAdminInvitationOTP(
      email,
      otpResult.code,
      {
        firstName,
        clubName,
        setupLink
      }
    )

    if (!notificationResult.success) {
      console.error('Error sending invitation email:', notificationResult.error)
      // Don't fail the request - OTP is stored, they can try again
      return NextResponse.json({
        success: true,
        message: `Admin created but email failed to send. OTP code: ${otpResult.code} (save this!)`,
        warning: 'Email delivery failed',
        code: process.env.NODE_ENV === 'development' ? otpResult.code : undefined
      })
    }

    // Success!
    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      code: process.env.NODE_ENV === 'development' ? otpResult.code : undefined  // Only in dev
    })
  } catch (error) {
    console.error('Error inviting admin:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
      },
      { status: 500 }
    )
  }
}
