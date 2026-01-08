import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { notificationService } from '@/lib/services/notification-service'
import { log } from '@/lib/logger'
import crypto from 'crypto'

/**
 * API route to resend a guardian invitation with a new token
 * Only primary guardians can resend invitations for their household
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
    const { invitationId } = body

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    // 3. Get the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('guardian_invitations')
      .select('*')
      .eq('id', invitationId)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // 4. Verify user is primary guardian for this household
    const { data: householdGuardian } = await supabaseAdmin
      .from('household_guardians')
      .select('is_primary')
      .eq('household_id', invitation.household_id)
      .eq('user_id', user.id)
      .single()

    if (!householdGuardian?.is_primary) {
      return NextResponse.json(
        { error: 'Only primary guardians can resend invitations' },
        { status: 403 }
      )
    }

    // 5. Only allow resending pending invitations
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only resend pending invitations' },
        { status: 400 }
      )
    }

    // 6. Generate new secure invitation token
    const newToken = crypto.randomBytes(32).toString('hex')
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7) // Expires in 7 days

    // 7. Update invitation with new token and expiry
    const { data: updatedInvitation, error: updateError } = await supabaseAdmin
      .from('guardian_invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        // Reset cancelled_at if it was set
        cancelled_at: null,
      })
      .eq('id', invitationId)
      .select()
      .single()

    if (updateError || !updatedInvitation) {
      log.error('Error updating invitation', updateError)
      return NextResponse.json(
        { error: 'Failed to update invitation' },
        { status: 500 }
      )
    }

    // 8. Get household and club info for email
    const { data: household } = await supabaseAdmin
      .from('households')
      .select('club_id')
      .eq('id', invitation.household_id)
      .single()

    const { data: club } = await supabaseAdmin
      .from('clubs')
      .select('name')
      .eq('id', household?.club_id)
      .single()

    const clubName = club?.name || 'Ski Club'

    // 9. Build invitation link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invitationLink = `${baseUrl}/accept-guardian-invitation?token=${newToken}`

    // 10. Send invitation email
    const notificationResult = await notificationService.sendGuardianInvitation(
      invitation.email,
      {
        inviterName: profile?.first_name || profile?.last_name ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined,
        inviterEmail: profile?.email || user.email || '',
        clubName,
        invitationLink,
      }
    )

    if (!notificationResult.success) {
      log.error('Error sending resend invitation email', notificationResult.error)
      // Don't fail the request - invitation is updated, they can try again
      return NextResponse.json({
        success: true,
        message: `Invitation updated but email failed to send. New invitation token: ${newToken}`,
        warning: 'Email delivery failed',
        invitationId: updatedInvitation.id,
        token: process.env.NODE_ENV === 'development' ? newToken : undefined,
      })
    }

    // Success!
    return NextResponse.json({
      success: true,
      message: `Invitation resent to ${invitation.email}`,
      invitationId: updatedInvitation.id,
      token: process.env.NODE_ENV === 'development' ? newToken : undefined,
    })
  } catch (error) {
    log.error('Error resending guardian invitation', error)
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

