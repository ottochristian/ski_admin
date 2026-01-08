import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

/**
 * API route to get invitation info (club_id) without requiring authentication
 * Used to pre-fill club selection on signup page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdminClient()

    // Find invitation by token
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('guardian_invitations')
      .select('household_id, email')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      )
    }

    // Get club_id from household
    const { data: household, error: householdError } = await supabaseAdmin
      .from('households')
      .select('club_id')
      .eq('id', invitation.household_id)
      .single()

    if (householdError || !household?.club_id) {
      return NextResponse.json(
        { error: 'Invalid household' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      clubId: household.club_id,
      email: invitation.email, // Return the email from the invitation
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

