import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { user } = authResult

  let body: {
    codeId: string
    orderId: string
    householdId: string
    athleteId?: string | null
    discountCents: number
    codeText: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { codeId, orderId, householdId, athleteId, discountCents, codeText } = body
  if (!codeId || !orderId || !householdId || !discountCents || !codeText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify caller owns the household
  const { data: guardian } = await supabase
    .from('household_guardians')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!guardian) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Verify order belongs to this household and is still unpaid
  const { data: order } = await supabase
    .from('orders')
    .select('id, household_id, total_amount, status')
    .eq('id', orderId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'unpaid') {
    return NextResponse.json({ error: 'Order is no longer pending payment' }, { status: 409 })
  }

  // Re-validate code is still active and limits not exceeded (race condition guard)
  const { data: dc } = await supabase
    .from('discount_codes')
    .select('id, is_active, max_uses, max_uses_per_household, max_uses_per_athlete, valid_to')
    .eq('id', codeId)
    .maybeSingle()

  if (!dc || !dc.is_active) {
    return NextResponse.json({ error: 'Discount code is no longer valid' }, { status: 409 })
  }

  if (dc.valid_to && new Date(dc.valid_to) < new Date()) {
    return NextResponse.json({ error: 'Discount code has expired' }, { status: 409 })
  }

  if (dc.max_uses !== null) {
    const { count } = await supabase
      .from('discount_code_uses')
      .select('*', { count: 'exact', head: true })
      .eq('code_id', codeId)

    if ((count ?? 0) >= dc.max_uses) {
      return NextResponse.json({ error: 'Discount code usage limit reached' }, { status: 409 })
    }
  }

  if (dc.max_uses_per_household !== null) {
    const { count } = await supabase
      .from('discount_code_uses')
      .select('*', { count: 'exact', head: true })
      .eq('code_id', codeId)
      .eq('household_id', householdId)

    if ((count ?? 0) >= dc.max_uses_per_household) {
      return NextResponse.json({
        error: 'You have already used this code the maximum number of times',
      }, { status: 409 })
    }
  }

  // Record the use
  const { error: useError } = await supabase
    .from('discount_code_uses')
    .insert({
      code_id: codeId,
      household_id: householdId,
      athlete_id: athleteId ?? null,
      order_id: orderId,
      discount_cents_applied: discountCents,
    })

  if (useError) {
    // Unique constraint — code already applied to this order
    if (useError.code === '23505') {
      return NextResponse.json({ error: 'Discount already applied to this order' }, { status: 409 })
    }
    return NextResponse.json({ error: useError.message }, { status: 500 })
  }

  // Deduct from order total (total_amount is in dollars)
  const discountDollars = discountCents / 100
  const newTotal = Math.max(0, Number(order.total_amount) - discountDollars)

  await supabase
    .from('orders')
    .update({ total_amount: newTotal })
    .eq('id', orderId)

  // Add a negative order_item so Stripe line items reflect the discount
  await supabase
    .from('order_items')
    .insert({
      order_id: orderId,
      description: `Discount: ${codeText.toUpperCase()}`,
      amount: -discountDollars,
    })

  return NextResponse.json({ success: true, newTotalCents: Math.round(newTotal * 100) })
}
