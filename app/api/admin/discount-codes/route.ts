import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createCodeSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, hyphens, or underscores')
    .transform((v) => v.toUpperCase().trim()),
  description: z.string().max(255).optional().nullable(),
  type: z.enum(['percent', 'fixed']),
  value: z.number().positive(),
  min_order_cents: z.number().int().min(0).default(0),
  max_uses: z.number().int().positive().optional().nullable(),
  max_uses_per_household: z.number().int().positive().optional().nullable(),
  max_uses_per_athlete: z.number().int().positive().optional().nullable(),
  valid_from: z.string().datetime().optional().nullable(),
  valid_to: z.string().datetime().optional().nullable(),
  season_id: z.string().uuid().optional().nullable(),
}).refine(
  (d) => d.type !== 'percent' || d.value <= 100,
  { message: 'Percentage discount cannot exceed 100', path: ['value'] }
)

// GET — list all discount codes for this club
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const supabase = createAdminClient()
  const clubId = authResult.profile.club_id

  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 400 })
  }

  const url = new URL(request.url)
  const seasonId = url.searchParams.get('seasonId')

  let query = supabase
    .from('discount_codes')
    .select('*, discount_code_uses(count)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })

  if (seasonId) {
    query = query.eq('season_id', seasonId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Flatten use_count from the nested count
  const codes = (data ?? []).map((row: any) => ({
    ...row,
    use_count: row.discount_code_uses?.[0]?.count ?? 0,
    discount_code_uses: undefined,
  }))

  return NextResponse.json({ codes })
}

// POST — create a new discount code
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const clubId = authResult.profile.club_id
  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createCodeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      ...parsed.data,
      club_id: clubId,
      created_by: authResult.user.id,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation — code already exists for this club
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Code "${parsed.data.code}" already exists for this club` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ code: data }, { status: 201 })
}
