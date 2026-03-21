import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const VALID_ROLES = ['parent', 'coach', 'admin', 'system_admin']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot edit your own account' }, { status: 400 })
    }

    const body = await request.json()
    const { first_name, last_name, email, club_id, role } = body

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Update email in auth if provided
    if (email !== undefined) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, { email })
      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
      }
    }

    // Build profile update object with only provided fields
    const profileUpdate: Record<string, unknown> = {}
    if (first_name !== undefined) profileUpdate.first_name = first_name
    if (last_name !== undefined) profileUpdate.last_name = last_name
    if (email !== undefined) profileUpdate.email = email
    if (club_id !== undefined) profileUpdate.club_id = club_id
    if (role !== undefined) profileUpdate.role = role

    if (Object.keys(profileUpdate).length > 0) {
      const { error: updateError } = await adminClient
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
