import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/api-auth'

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

    // Check if user already exists
    const supabaseAdmin = createSupabaseAdminClient()
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUser?.users?.some((u: { email?: string }) => u.email === email)

    if (userExists) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Build redirect URL for password setup
    let redirectTo: string
    if (process.env.NEXT_PUBLIC_APP_URL) {
      redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/setup-password`
    } else {
      // Default to localhost for development
      redirectTo = 'http://localhost:3000/setup-password'
    }

    console.log('Inviting coach:', { email, firstName, lastName, redirectTo })

    // Invite user by email
    let inviteOptions: { redirectTo?: string; data?: Record<string, any> } = {}

    if (redirectTo && redirectTo.startsWith('http')) {
      inviteOptions.redirectTo = redirectTo
    }

    // Add metadata for profile creation
    inviteOptions.data = {
      first_name: firstName,
      last_name: lastName,
      role: 'coach',
      club_id: profile.club_id,
    } as Record<string, any>

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteOptions)

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
          hint:
            inviteError.message?.includes('pattern')
              ? 'Check that redirectTo URL is valid and added to allowed redirect URLs in Supabase dashboard'
              : undefined,
        },
        { status: 400 }
      )
    }

    if (!inviteData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Update user metadata with coach info
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      inviteData.user.id,
      {
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role: 'coach',
          club_id: profile.club_id,
        },
      }
    )

    if (metadataError) {
      console.error('Error updating user metadata:', metadataError)
    }

    // Create profile for invited coach
    // First check if profile already exists (might be created by trigger)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', inviteData.user.id)
      .single()

    if (!existingProfile) {
      // Profile doesn't exist - create it
      const { error: profileError } = await supabaseAdmin.rpc('create_user_profile', {
        p_user_id: inviteData.user.id,
        p_email: email,
        p_first_name: firstName,
        p_last_name: lastName,
        p_role: 'coach',
        p_club_id: profile.club_id,
      })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Profile creation failed - try to continue anyway, might be created by trigger
      }
    } else {
      // Profile exists - update it to ensure correct role and club_id
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({
          role: 'coach',
          club_id: profile.club_id,
          first_name: firstName,
          last_name: lastName,
          email: email,
        })
        .eq('id', inviteData.user.id)

      if (updateProfileError) {
        console.error('Error updating profile:', updateProfileError)
      }
    }

    // Verify profile exists before creating coach record
    const { data: profileCheck } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', inviteData.user.id)
      .single()

    if (!profileCheck) {
      return NextResponse.json(
        {
          error: 'Failed to create profile for coach',
          details: 'Profile was not created. Please try again or contact support.',
        },
        { status: 500 }
      )
    }

    // Create or update coach record linked to the profile
    // Use upsert to handle case where coach record might already exist
    const { error: coachError } = await supabaseAdmin
      .from('coaches')
      .upsert(
        {
          profile_id: inviteData.user.id,
          club_id: profile.club_id,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
        },
        {
          onConflict: 'profile_id',
          ignoreDuplicates: false,
        }
      )

    if (coachError) {
      console.error('Error creating/updating coach record:', coachError)
      
      // Check if it's a unique constraint violation on email
      if (coachError.code === '23505' && coachError.message?.includes('email')) {
        // Coach record exists with this email but different profile_id
        // Try to update it
        const { error: updateError } = await supabaseAdmin
          .from('coaches')
          .update({
            profile_id: inviteData.user.id,
            club_id: profile.club_id,
            first_name: firstName,
            last_name: lastName,
            phone: phone || null,
          })
          .eq('email', email)

        if (updateError) {
          console.error('Error updating existing coach record:', updateError)
          return NextResponse.json(
            {
              success: true,
              message: `Invitation sent to ${email}, but there was an error updating the coach record. Please contact support.`,
              warning: updateError.message,
            },
            { status: 200 }
          )
        }
      } else {
        // Other error
        return NextResponse.json(
          {
            success: true,
            message: `Invitation sent to ${email}, but there was an error creating the coach record. Please contact support.`,
            warning: coachError.message,
          },
          { status: 200 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      coachId: inviteData.user.id,
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


