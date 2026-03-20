import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

type ProfileRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type ProgramRevenue = {
  programId: string
  programName: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  registrationCount: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get('seasonId')
  const requestedClubId = searchParams.get('clubId')
  const dateRange = searchParams.get('dateRange')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const programIdFilter = searchParams.get('programId')

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

  // Date range bounds
  let dateFilterFrom: string | null = null
  let dateFilterTo: string | null = null

  if (dateRange === 'custom' && dateFrom) {
    dateFilterFrom = dateFrom
    dateFilterTo = dateTo || new Date().toISOString().split('T')[0]
  } else if (dateRange) {
    const now = new Date()
    if (dateRange === 'last-7') dateFilterFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    else if (dateRange === 'last-30') dateFilterFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    else if (dateRange === 'last-90') dateFilterFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    dateFilterTo = now.toISOString().split('T')[0]
  }

  // 1. Registrations — for counts and program grouping
  let regsQuery = admin
    .from('registrations')
    .select('id, sub_programs!inner(id, program_id, programs(id, name))')
    .eq('season_id', seasonId)
    .eq('club_id', clubIdToUse)

  if (programIdFilter) {
    regsQuery = regsQuery.eq('sub_programs.program_id', programIdFilter)
  }
  if (dateFilterFrom) regsQuery = regsQuery.gte('created_at', dateFilterFrom)
  if (dateFilterTo) regsQuery = regsQuery.lte('created_at', dateFilterTo + 'T23:59:59')

  const { data: regsData, error: regError } = await regsQuery
  if (regError) {
    return NextResponse.json({ error: regError.message || 'Failed to load registrations' }, { status: 500 })
  }

  const regs: any[] = regsData || []
  const regIds = regs.map((r: any) => r.id)

  // 2. Order items — for authoritative revenue per registration
  let revenueByReg: Record<string, { paidAmount: number; outstandingAmount: number }> = {}

  if (regIds.length > 0) {
    const { data: itemsData, error: itemsError } = await admin
      .from('order_items')
      .select('registration_id, amount, orders!inner(status, club_id, season_id)')
      .in('registration_id', regIds)
      .eq('orders.club_id', clubIdToUse)
      .eq('orders.season_id', seasonId)

    if (!itemsError) {
      for (const oi of itemsData ?? []) {
        const rid = (oi as any).registration_id
        const orderStatus = ((oi as any).orders?.status || '').toLowerCase()
        if (!revenueByReg[rid]) revenueByReg[rid] = { paidAmount: 0, outstandingAmount: 0 }
        if (orderStatus === 'paid') {
          revenueByReg[rid].paidAmount += Number((oi as any).amount || 0)
        } else {
          revenueByReg[rid].outstandingAmount += Number((oi as any).amount || 0)
        }
      }
    }
  }

  // 3. Aggregate by program
  const programMap = new Map<string, ProgramRevenue>()

  regs.forEach((row: any) => {
    const programId = row.sub_programs?.programs?.id
    const programName = row.sub_programs?.programs?.name || 'Unknown Program'
    if (!programId) return

    if (!programMap.has(programId)) {
      programMap.set(programId, {
        programId,
        programName,
        totalAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        registrationCount: 0,
      })
    }

    const prog = programMap.get(programId)!
    prog.registrationCount += 1

    const rev = revenueByReg[row.id]
    if (rev) {
      prog.paidAmount += rev.paidAmount
      prog.outstandingAmount += rev.outstandingAmount
      prog.totalAmount += rev.paidAmount + rev.outstandingAmount
    }
  })

  const result = Array.from(programMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)

  return NextResponse.json({ programs: result })
}
