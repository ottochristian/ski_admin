import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { log } from '@/lib/logger'

const MAX_GUARDIANS = 3 // 1 primary + 2 secondary

/**
 * API route to accept a guardian invitation
 * User must be authenticated (either existing user or just signed up)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user (must be logged in to accept)
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, supabase } = authResult
    const supabaseAdmin = createSupabaseAdminClient()
    
    // Fetch profile separately (requireAuth doesn't return profile)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, club_id')
      .eq('id', user.id)
      .maybeSingle()

    // 2. Parse request body
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    // 3. Find invitation by token
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('guardian_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      )
    }

    // 4. Verify email matches (case-insensitive)
    if (invitation.email.toLowerCase() !== (user.email || '').toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation is for a different email address' },
        { status: 403 }
      )
    }

    // 5. Check if user is already a guardian in ANY household
    const { data: isAlreadyGuardian } = await supabaseAdmin.rpc(
      'is_user_guardian_in_any_household',
      { p_user_id: user.id }
    )

    if (isAlreadyGuardian) {
      // Mark invitation as cancelled
      await supabaseAdmin
        .from('guardian_invitations')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'You are already a guardian in another household. Each parent can only belong to one household.' },
        { status: 400 }
      )
    }

    // 6. Check guardian count for this household
    const { data: guardianCount } = await supabaseAdmin.rpc(
      'get_household_guardian_count',
      { p_household_id: invitation.household_id }
    )

    if ((guardianCount || 0) >= MAX_GUARDIANS) {
      // Mark invitation as cancelled (household is full)
      await supabaseAdmin
        .from('guardian_invitations')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: `This household has reached the maximum of ${MAX_GUARDIANS} guardians` },
        { status: 400 }
      )
    }

    // 7. Ensure user has a profile (create if needed)
    if (!profile) {
      // Get club_id from household
      const { data: household } = await supabaseAdmin
        .from('households')
        .select('club_id')
        .eq('id', invitation.household_id)
        .single()

      if (!household?.club_id) {
        return NextResponse.json(
          { error: 'Invalid household' },
          { status: 400 }
        )
      }

      // Try RPC function first, then direct insert
      // IMPORTANT: Check if profile already exists and has first_name/last_name before overwriting
      const { data: existingProfileData } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, email, club_id')
        .eq('id', user.id)
        .maybeSingle()
      
      // Preserve existing first_name/last_name if they exist, otherwise use null
      // The RPC function uses COALESCE to preserve existing values, but we need to pass them explicitly
      const preserveFirstName = existingProfileData?.first_name || null
      const preserveLastName = existingProfileData?.last_name || null
      
      let profileError = null
      try {
        const { error: rpcError } = await supabaseAdmin.rpc('create_user_profile', {
          p_user_id: user.id,
          p_email: user.email || invitation.email,
          p_first_name: preserveFirstName,
          p_last_name: preserveLastName,
          p_role: 'parent',
          p_club_id: household.club_id,
        })
        
        if (rpcError) {
          profileError = rpcError
        }
      } catch (rpcErr) {
        // If RPC fails, try direct insert (only if profile doesn't exist)
        if (!existingProfileData) {
          const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || invitation.email,
              first_name: preserveFirstName,
              last_name: preserveLastName,
              role: 'parent',
              club_id: household.club_id,
            })
          
          if (insertError) {
            profileError = insertError
          }
        } else {
          // Profile exists - just update club_id if needed, but preserve names
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              club_id: household.club_id,
              // Don't update first_name/last_name - preserve existing values
            })
            .eq('id', user.id)
          
          if (updateError) {
            profileError = updateError
          }
        }
      }

      if (profileError) {
        log.error('Error creating profile for guardian invitation', profileError)
        // Check if it's a duplicate key error (profile already exists)
        if (profileError.code === '23505') {
          // Profile already exists, continue
          log.info('Profile already exists, continuing...')
        } else {
          return NextResponse.json(
            { 
              error: `Failed to create profile: ${profileError.message}`,
              details: profileError.details,
              hint: profileError.hint,
            },
            { status: 500 }
          )
        }
      }
      
      // Verify profile was created
      const { data: verifyProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, club_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!verifyProfile && profileError?.code !== '23505') {
        log.error('Profile creation failed - profile does not exist after insert')
        return NextResponse.json(
          { error: 'Failed to create profile - profile was not created. Please contact support.' },
          { status: 500 }
        )
      }
    }

    // 8. Add user as secondary guardian
    const { error: guardianError } = await supabaseAdmin
      .from('household_guardians')
      .insert({
        household_id: invitation.household_id,
        user_id: user.id,
        is_primary: false,
      })

    if (guardianError) {
      // Check if it's a unique constraint violation (already exists)
      if (guardianError.code === '23505') {
        // Mark invitation as accepted anyway
        await supabaseAdmin
          .from('guardian_invitations')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', invitation.id)

        return NextResponse.json({
          success: true,
          message: 'You are already a guardian in this household',
        })
      }

      log.error('Error adding guardian', guardianError)
      return NextResponse.json(
        { error: 'Failed to add guardian to household' },
        { status: 500 }
      )
    }

    // 9. Mark invitation as accepted
    await supabaseAdmin
      .from('guardian_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    // 10. Get household club_id for redirect
    const { data: household } = await supabaseAdmin
      .from('households')
      .select('club_id')
      .eq('id', invitation.household_id)
      .single()

    const clubId = household?.club_id

    let clubSlug = 'default'
    if (clubId) {
      const { data: club } = await supabaseAdmin
        .from('clubs')
        .select('slug')
        .eq('id', clubId)
        .single()

      clubSlug = club?.slug || 'default'
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted! You are now a guardian for this household.',
      redirectTo: `/clubs/${clubSlug}/parent/dashboard`,
    })
  } catch (error) {
    log.error('Error accepting guardian invitation', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

