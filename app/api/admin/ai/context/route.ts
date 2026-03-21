import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api-auth'
import { createSupabaseAdminClient as createAdminClient } from '@/lib/supabase-server'

const postSchema = z.object({
  ai_training_context: z.string(),
})

// GET — return current ai_training_context for the club
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  const clubId = profile.club_id
  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clubs')
    .select('ai_training_context')
    .eq('id', clubId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  return NextResponse.json({ ai_training_context: data.ai_training_context ?? '' })
}

// POST — save ai_training_context for the club
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  const clubId = profile.club_id
  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('clubs')
    .update({ ai_training_context: parsed.data.ai_training_context.trim() || null })
    .eq('id', clubId)

  if (error) {
    return NextResponse.json({ error: 'Failed to save context' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
