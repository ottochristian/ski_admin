import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const postSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional().nullable(),
  clubId: z.string().uuid('Invalid club ID'),
})

export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per IP per hour (account creation)
  const rateLimitCheck = checkRateLimit(request, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsedBody = postSchema.safeParse(raw)
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0].message }, { status: 400 })
  }

  const { firstName, lastName, phone, clubId } = parsedBody.data

  const admin = createAdminClient()

  // Create profile (skip if already exists)
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!existing) {
    const { error: profileError } = await admin.from('profiles').insert({
      id: user.id,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      role: 'parent',
      club_id: clubId,
    })

    if (profileError && profileError.code !== '23505') {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
  }

  // Create household
  const { data: household, error: householdError } = await admin
    .from('households')
    .insert({
      club_id: clubId,
      primary_email: user.email,
      phone: phone || null,
    })
    .select('id')
    .single()

  if (householdError) {
    return NextResponse.json({ error: householdError.message }, { status: 500 })
  }

  // Link user to household
  await admin.from('household_guardians').insert({
    household_id: household.id,
    user_id: user.id,
    is_primary: true,
  })

  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .single()

  return NextResponse.json({ success: true, clubSlug: club?.slug })
}
