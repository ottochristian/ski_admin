import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const patchSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  club_id: z.string().uuid().optional().nullable(),
  role: z.enum(['parent', 'coach', 'admin', 'system_admin']).optional(),
}).refine(
  (d) => Object.values(d).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
)

async function ensureHousehold(admin: SupabaseClient, userId: string, clubId?: string) {
  const { data: existing } = await admin
    .from('household_guardians')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return

  const { data: profile } = await admin
    .from('profiles')
    .select('email, club_id')
    .eq('id', userId)
    .single()

  const effectiveClubId = clubId ?? profile?.club_id
  if (!effectiveClubId) return

  const { data: household } = await admin
    .from('households')
    .insert({ club_id: effectiveClubId, primary_email: profile?.email })
    .select('id')
    .single()

  if (!household) return

  await admin.from('household_guardians').insert({
    household_id: household.id,
    user_id: userId,
    is_primary: true,
  })
}

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

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const parsedBody = patchSchema.safeParse(raw)
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues[0].message }, { status: 400 })
    }

    const { first_name, last_name, email, club_id, role } = parsedBody.data

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

    // If role is being set to parent, ensure they have a household
    if (role === 'parent') {
      await ensureHousehold(adminClient, userId, club_id ?? undefined)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
