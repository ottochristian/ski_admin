import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'

type ProfileRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type SummaryResponse = {
  totals: {
    registrations: number
    athletes: number
    households: number
  }
  status: {
    pending: number
    confirmed: number
    waitlisted: number
    cancelled: number
  }
  payments: {
    paidCount: number
    unpaidCount: number
    paidAmount: number
    unpaidAmount: number
    pendingAmount: number
  }
  refunds: {
    count: number
    amount: number
  }
  netRevenue: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get('seasonId')
  const requestedClubId = searchParams.get('clubId')

  const authResult = await requireAdmin(req)
  if (authResult instanceof NextResponse) return authResult

  const { profile } = authResult
  const role = profile.role as ProfileRole
  const isSystemAdmin = role === 'system_admin'
  const clubIdToUse = isSystemAdmin ? requestedClubId : profile.club_id

  if (!seasonId) {
    return NextResponse.json({ error: 'seasonId is required' }, { status: 400 })
  }
  if (!clubIdToUse) {
    return NextResponse.json({ error: 'clubId is required' }, { status: 400 })
  }
  if (!isSystemAdmin && clubIdToUse !== profile.club_id) {
    return NextResponse.json({ error: 'Forbidden: club mismatch' }, { status: 403 })
  }
  if (isSystemAdmin && !requestedClubId) {
    return NextResponse.json({ error: 'clubId is required for system admins' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Registrations — for counts, status breakdown, athlete/household cardinality
  const { data: regs, error: regError } = await admin
    .from('registrations')
    .select('id, status, payment_status, athlete_id, athletes(household_id)')
    .eq('season_id', seasonId)
    .eq('club_id', clubIdToUse)

  if (regError) {
    return NextResponse.json({ error: regError.message || 'Failed to load registrations' }, { status: 500 })
  }

  // 2. Orders — for authoritative revenue figures
  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .select('total_amount, status')
    .eq('season_id', seasonId)
    .eq('club_id', clubIdToUse)

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message || 'Failed to load orders' }, { status: 500 })
  }

  const registrations = regs || []

  const totals = { registrations: registrations.length, athletes: 0, households: 0 }
  const status = { pending: 0, confirmed: 0, waitlisted: 0, cancelled: 0 }
  const athleteIds = new Set<string>()
  const householdIds = new Set<string>()

  registrations.forEach((reg: any) => {
    const statusKey = (reg.status || '').toLowerCase() as keyof typeof status
    if (status[statusKey] !== undefined) status[statusKey] += 1
    if (reg.athlete_id) athleteIds.add(reg.athlete_id)
    const householdId = reg.athletes?.household_id
    if (householdId) householdIds.add(householdId)
  })

  totals.athletes = athleteIds.size
  totals.households = householdIds.size

  // Count paid/unpaid from registration payment_status (for counts)
  const paidCount = registrations.filter((r: any) => (r.payment_status || '').toLowerCase() === 'paid').length
  const unpaidCount = registrations.length - paidCount

  // Revenue amounts from orders (authoritative)
  let paidAmount = 0
  let unpaidAmount = 0

  ;(orders || []).forEach((o: any) => {
    const amt = Number(o.total_amount || 0)
    if ((o.status || '').toLowerCase() === 'paid') {
      paidAmount += amt
    } else {
      unpaidAmount += amt
    }
  })

  const refunds = { count: 0, amount: 0 }
  const netRevenue = paidAmount - refunds.amount

  const response: SummaryResponse = {
    totals,
    status,
    payments: {
      paidCount,
      unpaidCount,
      paidAmount,
      unpaidAmount,
      pendingAmount: 0,
    },
    refunds,
    netRevenue,
  }

  return NextResponse.json(response)
}
