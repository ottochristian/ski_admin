import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const postSchema = z.object({
  code: z.string().min(1),
  clubId: z.string().uuid(),
  householdId: z.string().uuid(),
  orderAmountCents: z.number().int().positive(),
  athleteIds: z.array(z.string().uuid()).optional(),
})

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { user } = authResult

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ valid: false, reason: 'Invalid request' }, { status: 400 })
  }

  const parsedBody = postSchema.safeParse(raw)
  if (!parsedBody.success) {
    return NextResponse.json({ valid: false, reason: parsedBody.error.issues[0].message }, { status: 400 })
  }

  const { code, clubId, householdId, orderAmountCents, athleteIds = [] } = parsedBody.data

  const supabase = createAdminClient()

  // Verify caller is a guardian of this household
  const { data: guardian } = await supabase
    .from('household_guardians')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!guardian) {
    return NextResponse.json({ valid: false, reason: 'Unauthorized' }, { status: 403 })
  }

  // Fetch the code
  const { data: dc } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('club_id', clubId)
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()

  if (!dc) {
    return NextResponse.json({ valid: false, reason: 'Code not found' })
  }

  if (!dc.is_active) {
    return NextResponse.json({ valid: false, reason: 'This code is no longer active' })
  }

  const now = new Date()
  if (dc.valid_from && new Date(dc.valid_from) > now) {
    return NextResponse.json({ valid: false, reason: 'This code is not yet valid' })
  }
  if (dc.valid_to && new Date(dc.valid_to) < now) {
    return NextResponse.json({ valid: false, reason: 'This code has expired' })
  }

  if (dc.min_order_cents && orderAmountCents < dc.min_order_cents) {
    const minDollars = (dc.min_order_cents / 100).toFixed(2)
    return NextResponse.json({
      valid: false,
      reason: `This code requires a minimum order of $${minDollars}`,
    })
  }

  // Check global use limit
  if (dc.max_uses !== null) {
    const { count: globalCount } = await supabase
      .from('discount_code_uses')
      .select('*', { count: 'exact', head: true })
      .eq('code_id', dc.id)

    if ((globalCount ?? 0) >= dc.max_uses) {
      return NextResponse.json({ valid: false, reason: 'This code has reached its usage limit' })
    }
  }

  // Check per-household limit
  if (dc.max_uses_per_household !== null) {
    const { count: householdCount } = await supabase
      .from('discount_code_uses')
      .select('*', { count: 'exact', head: true })
      .eq('code_id', dc.id)
      .eq('household_id', householdId)

    if ((householdCount ?? 0) >= dc.max_uses_per_household) {
      return NextResponse.json({
        valid: false,
        reason: 'You have already used this code the maximum number of times',
      })
    }
  }

  // Check per-athlete limit
  if (dc.max_uses_per_athlete !== null && athleteIds.length > 0) {
    for (const athleteId of athleteIds) {
      const { count: athleteCount } = await supabase
        .from('discount_code_uses')
        .select('*', { count: 'exact', head: true })
        .eq('code_id', dc.id)
        .eq('athlete_id', athleteId)

      if ((athleteCount ?? 0) >= dc.max_uses_per_athlete) {
        return NextResponse.json({
          valid: false,
          reason: 'This code has already been used for one or more athletes in your cart',
        })
      }
    }
  }

  // Calculate discount amount
  let discountCents: number
  if (dc.type === 'percent') {
    discountCents = Math.floor((orderAmountCents * Number(dc.value)) / 100)
  } else {
    discountCents = Math.min(Math.round(Number(dc.value) * 100), orderAmountCents)
  }

  // Stripe minimum: final total must be >= $0.50 (50 cents) or exactly $0
  const finalCents = orderAmountCents - discountCents
  if (finalCents > 0 && finalCents < 50) {
    discountCents = orderAmountCents - 50
  }

  return NextResponse.json({
    valid: true,
    codeId: dc.id,
    discountCents,
    description: dc.description ?? dc.code,
    type: dc.type,
    value: Number(dc.value),
  })
}
