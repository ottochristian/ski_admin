import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

type ProfileRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type ProgramSummary = {
  programId: string
  programName: string
  registrations: number
  confirmed: number
  pending: number
  waitlisted: number
  cancelled: number
  paidAmount: number
  unpaidAmount: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get('seasonId')
  const requestedClubId = searchParams.get('clubId')

  if (!seasonId) {
    return NextResponse.json({ error: 'seasonId is required' }, { status: 400 })
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof NextResponse) return authResult

  const { profile } = authResult
  const role = profile.role as ProfileRole
  const isSystemAdmin = role === 'system_admin'
  const clubIdToUse = isSystemAdmin ? requestedClubId : profile.club_id

  const admin = createAdminClient()

  // 1. Registrations — for status counts and program grouping
  const { data: regsData, error: regError } = await admin
    .from('registrations')
    .select('id, status, sub_programs!inner(id, program_id, programs(name))')
    .eq('season_id', seasonId)
    .eq('club_id', clubIdToUse)

  if (regError) {
    return NextResponse.json({ error: regError.message || 'Failed to load registrations' }, { status: 500 })
  }

  const regs: any[] = regsData || []

  // 2. Order items — for authoritative revenue per registration
  const regIds = regs.map((r: any) => r.id)
  let revenueByReg: Record<string, { paidAmount: number; unpaidAmount: number }> = {}

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
        if (!revenueByReg[rid]) revenueByReg[rid] = { paidAmount: 0, unpaidAmount: 0 }
        if (orderStatus === 'paid') {
          revenueByReg[rid].paidAmount += Number((oi as any).amount || 0)
        } else {
          revenueByReg[rid].unpaidAmount += Number((oi as any).amount || 0)
        }
      }
    }
  }

  // 3. Aggregate by program
  const summaries = new Map<string, ProgramSummary>()

  regs.forEach((row: any) => {
    const programId = row.sub_programs?.program_id as string | undefined
    if (!programId) return
    const programName = row.sub_programs?.programs?.name || 'Unknown program'

    if (!summaries.has(programId)) {
      summaries.set(programId, {
        programId,
        programName,
        registrations: 0,
        confirmed: 0,
        pending: 0,
        waitlisted: 0,
        cancelled: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      })
    }

    const s = summaries.get(programId)!
    s.registrations += 1

    const status = (row.status || '').toLowerCase()
    if (status === 'confirmed') s.confirmed += 1
    else if (status === 'pending') s.pending += 1
    else if (status === 'waitlisted') s.waitlisted += 1
    else if (status === 'cancelled') s.cancelled += 1

    const rev = revenueByReg[row.id]
    if (rev) {
      s.paidAmount += rev.paidAmount
      s.unpaidAmount += rev.unpaidAmount
    }
  })

  const result = Array.from(summaries.values()).sort((a, b) =>
    a.programName.localeCompare(b.programName)
  )

  return NextResponse.json({ bySport: result })
}
