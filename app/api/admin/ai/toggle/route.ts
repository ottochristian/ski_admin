import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api-auth'
import { createSupabaseAdminClient as createAdminClient } from '@/lib/supabase-server'

const postSchema = z.object({
  enabled: z.boolean(),
  club_id: z.string().uuid().optional(),
})

const patchSchema = z.object({
  ai_auto_briefing: z.boolean().optional(),
  ai_insights_enabled: z.boolean().optional(),
}).refine(
  (d) => d.ai_auto_briefing !== undefined || d.ai_insights_enabled !== undefined,
  { message: 'At least one of `ai_auto_briefing` or `ai_insights_enabled` (boolean) is required' }
)

// GET — return current ai_enabled status for the club
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  const admin = createAdminClient()
  const clubId = profile.club_id

  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('clubs')
    .select('id, name, ai_enabled, ai_auto_briefing, ai_insights_enabled')
    .eq('id', clubId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  // Also return monthly usage stats
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: usage } = await admin
    .from('ai_usage')
    .select('feature, prompt_tokens, completion_tokens, created_at')
    .eq('club_id', clubId)
    .gte('created_at', startOfMonth.toISOString())

  const totalRequests = usage?.length ?? 0
  const totalTokens = usage?.reduce(
    (sum: number, u: { prompt_tokens: number; completion_tokens: number }) => sum + u.prompt_tokens + u.completion_tokens,
    0
  ) ?? 0

  return NextResponse.json({
    ai_enabled: data.ai_enabled,
    ai_auto_briefing: data.ai_auto_briefing ?? false,
    ai_insights_enabled: data.ai_insights_enabled ?? false,
    usage_this_month: { requests: totalRequests, tokens: totalTokens },
  })
}

// POST — toggle ai_enabled for the club
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

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

  const { enabled, club_id: bodyClubId } = parsed.data

  // System admins must supply club_id; regular admins use their own
  let clubId = profile.club_id
  if (profile.role === 'system_admin') {
    if (!bodyClubId) {
      return NextResponse.json({ error: 'club_id required for system admin' }, { status: 400 })
    }
    clubId = bodyClubId
  }

  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clubs')
    .update({ ai_enabled: enabled })
    .eq('id', clubId)
    .select('id, name, ai_enabled')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update club' }, { status: 500 })
  }

  return NextResponse.json({ ai_enabled: data.ai_enabled })
}

// PATCH — toggle ai_auto_briefing and/or ai_insights_enabled for the club
export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const clubId = profile.club_id
  if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 403 })

  const updateObj: { ai_auto_briefing?: boolean; ai_insights_enabled?: boolean } = {}
  if (parsed.data.ai_auto_briefing !== undefined) updateObj.ai_auto_briefing = parsed.data.ai_auto_briefing
  if (parsed.data.ai_insights_enabled !== undefined) updateObj.ai_insights_enabled = parsed.data.ai_insights_enabled

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clubs')
    .update(updateObj)
    .eq('id', clubId)
    .select('ai_enabled, ai_auto_briefing, ai_insights_enabled')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({
    ai_enabled: data.ai_enabled,
    ai_auto_briefing: data.ai_auto_briefing ?? false,
    ai_insights_enabled: data.ai_insights_enabled ?? false,
  })
}
