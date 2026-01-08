import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { householdGuardiansService } from '@/lib/services/household-guardians-service'
import { notificationService } from '@/lib/services/notification-service'
import { log } from '@/lib/logger'
import crypto from 'crypto'

const MAX_GUARDIANS = 3 // 1 primary + 2 secondary

/**
 * API route to invite a secondary guardian to a household
 * Only primary guardians can invite secondary guardians
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, profile } = authResult
    const supabaseAdmin = createSupabaseAdminClient()

    // 2. Parse request body
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const normalizedEmail = email.toLowerCase().trim()

    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // 3. Get user's household_id directly using admin client (service client may not have session in API routes)
    const { data: householdGuardian, error: hgError } = await supabaseAdmin
      .from('household_guardians')
      .select('household_id, is_primary')
      .eq('user_id', user.id)
      .maybeSingle()

    if (hgError) {
      log.error('Error fetching household guardian', hgError)
      return NextResponse.json(
        { error: 'Failed to fetch household information' },
        { status: 500 }
      )
    }

    if (!householdGuardian?.household_id) {
      return NextResponse.json(
        { error: 'No household found for your account' },
        { status: 403 }
      )
    }

    const householdId = householdGuardian.household_id

    // Verify user is primary guardian
    if (!householdGuardian.is_primary) {
      return NextResponse.json(
        { error: 'Only primary guardians can invite secondary guardians' },
        { status: 403 }
      )
    }

    // 4. Check if user already exists in ANY household (not just this one)
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUser?.users?.some(
      (u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail
    )

    let existingProfileId: string | null = null
    
    if (userExists) {
      // Check if user is already a guardian in any household
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (existingProfile) {
        existingProfileId = existingProfile.id
        
        const { data: isGuardian } = await supabaseAdmin.rpc(
          'is_user_guardian_in_any_household',
          { p_user_id: existingProfile.id }
        )

        if (isGuardian) {
          return NextResponse.json(
            { error: 'This user is already a guardian in another household. Each parent can only belong to one household.' },
            { status: 400 }
          )
        }
      }
    }

    // 5. Check guardian count (including pending invitations)
    const countResult = await householdGuardiansService.getGuardianCountForHousehold(householdId)
    if (countResult.error) {
      return NextResponse.json(
        { error: 'Failed to check guardian count' },
        { status: 500 }
      )
    }

    const currentCount = countResult.data || 0
    if (currentCount >= MAX_GUARDIANS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_GUARDIANS} guardians allowed per household (including pending invitations)` },
        { status: 400 }
      )
    }

    // 6. Check for existing pending invitation for this email
    const { data: existingInvitation } = await supabaseAdmin
      .from('guardian_invitations')
      .select('id')
      .eq('household_id', householdId)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 400 }
      )
    }

    // 7. Check if email is already a guardian in this household
    if (userExists && existingProfileId) {
      const { data: existingGuardian } = await supabaseAdmin
        .from('household_guardians')
        .select('id')
        .eq('household_id', householdId)
        .eq('user_id', existingProfileId)
        .maybeSingle()

      if (existingGuardian) {
        return NextResponse.json(
          { error: 'This user is already a guardian in this household' },
          { status: 400 }
        )
      }
    }

    // 8. Generate secure invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    // 9. Create invitation record
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('guardian_invitations')
      .insert({
        household_id: householdId,
        invited_by_user_id: user.id,
        email: normalizedEmail,
        token: invitationToken,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError || !invitation) {
      log.error('Error creating guardian invitation', inviteError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // 10. Get household and club info for email
    const { data: household } = await supabaseAdmin
      .from('households')
      .select('club_id')
      .eq('id', householdId)
      .single()

    const { data: club } = await supabaseAdmin
      .from('clubs')
      .select('name')
      .eq('id', household?.club_id)
      .single()

    const clubName = club?.name || 'Ski Club'

    // 11. Build invitation link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invitationLink = `${baseUrl}/accept-guardian-invitation?token=${invitationToken}`

    // 12. Send invitation email
    const notificationResult = await notificationService.sendGuardianInvitation(
      normalizedEmail,
      {
        inviterName: profile?.first_name || profile?.last_name ? `${profile.first_name} ${profile.last_name}`.trim() : undefined,
        inviterEmail: profile?.email || user.email || '',
        clubName,
        invitationLink,
      }
    )

    if (!notificationResult.success) {
      log.error('Error sending guardian invitation email', notificationResult.error)
      // Don't fail the request - invitation is created, they can resend
      return NextResponse.json({
        success: true,
        message: `Invitation created but email failed to send. Invitation token: ${invitationToken}`,
        warning: 'Email delivery failed',
        invitationId: invitation.id,
        token: process.env.NODE_ENV === 'development' ? invitationToken : undefined,
      })
    }

    // Success!
    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${normalizedEmail}`,
      invitationId: invitation.id,
      token: process.env.NODE_ENV === 'development' ? invitationToken : undefined,
    })
  } catch (error) {
    log.error('Error inviting guardian', error)
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

