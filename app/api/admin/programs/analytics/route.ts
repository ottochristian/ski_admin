import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

type ProfileRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type ProgramAnalytics = {
  id: string
  name: string
  currentEnrollment: number  // confirmed + pending only
  waitlistedCount: number
  maxCapacity: number | null
  enrollmentRate: number | null
  revenue: number
  paidCount: number
  unpaidCount: number
  pricePerPerson: number
  avgRevenuePerAthlete: number
}

type ProgramsSummary = {
  totalPrograms: number
  totalWaitlisted: number
  avgEnrollmentRate: number | null
  mostPopularProgram: { id: string; name: string; enrollment: number } | null
  totalRevenue: number
  avgRevenuePerProgram: number
}

type Response = {
  summary: ProgramsSummary
  programs: ProgramAnalytics[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get('seasonId')
  const requestedClubId = searchParams.get('clubId')

  // Require admin authentication
  const authResult = await requireAdmin(req)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { user, supabase, profile } = authResult
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

  try {
    // 1. Get all registrations with their programs
    const { data: registrations, error: registrationsError } = await admin
      .from('registrations')
      .select(`
        id,
        athlete_id,
        status,
        payment_status,
        sub_programs!inner(
          id,
          program_id,
          registration_fee,
          max_capacity,
          programs!inner(
            id,
            name,
            status
          )
        )
      `)
      .eq('season_id', seasonId)
      .eq('club_id', clubIdToUse)
      .in('status', ['confirmed', 'pending', 'waitlisted'])

    if (registrationsError) {
      console.error('Registrations error:', registrationsError)
      throw registrationsError
    }

    // 1b. Get order items for authoritative revenue per registration
    const regIds = (registrations || []).map((r: any) => r.id)
    let revenueByReg: Record<string, number> = {}

    if (regIds.length > 0) {
      const { data: itemsData } = await admin
        .from('order_items')
        .select('registration_id, amount, orders!inner(status, club_id, season_id)')
        .in('registration_id', regIds)
        .eq('orders.club_id', clubIdToUse)
        .eq('orders.season_id', seasonId)
        .eq('orders.status', 'paid')

      for (const oi of itemsData ?? []) {
        const rid = (oi as any).registration_id
        revenueByReg[rid] = (revenueByReg[rid] || 0) + Number((oi as any).amount || 0)
      }
    }

    log.info('Programs Analytics - Found registrations', { count: registrations?.length || 0, clubId: clubIdToUse, seasonId })

    if (!registrations || registrations.length === 0) {
      log.info('Programs Analytics - No registrations found, returning empty result')
      return NextResponse.json({
        summary: {
          totalPrograms: 0,
          totalWaitlisted: 0,
          avgEnrollmentRate: null,
          mostPopularProgram: null,
          totalRevenue: 0,
          avgRevenuePerProgram: 0,
        },
        programs: [],
      })
    }

    // 2. Group registrations by program
    const programMap = new Map<string, {
      id: string
      name: string
      subProgramPrices: number[]
      seenSubProgramIds: Set<string>
      // Per-sub-program enrollment + capacity — used to compute an accurate fill rate
      // that excludes sub-programs with no capacity limit from the denominator.
      subProgramEnrolled: Map<string, number>
      subProgramCapacity: Map<string, number>
      status: string
      registrations: any[]
      waitlistedRegs: any[]
      enrolledAthleteIds: Set<string>
      waitlistedAthleteIds: Set<string>
    }>()

    registrations.forEach((reg: any) => {
      const subProgram = reg.sub_programs
      const program = subProgram?.programs

      if (program && subProgram) {
        log.debug('Program found', { name: program.name, status: program.status })
        const programStatus = (program.status ?? '').toUpperCase()
        if (programStatus === 'ACTIVE' || programStatus === 'FULL') {
          if (!programMap.has(program.id)) {
            programMap.set(program.id, {
              id: program.id,
              name: program.name,
              subProgramPrices: [],
              seenSubProgramIds: new Set(),
              subProgramEnrolled: new Map(),
              subProgramCapacity: new Map(),
              status: program.status,
              registrations: [],
              waitlistedRegs: [],
              enrolledAthleteIds: new Set(),
              waitlistedAthleteIds: new Set(),
            })
          }
          const programData = programMap.get(program.id)!

          if (reg.status === 'waitlisted') {
            programData.waitlistedRegs.push(reg)
            programData.waitlistedAthleteIds.add(reg.athlete_id)
          } else {
            programData.registrations.push(reg)
            programData.enrolledAthleteIds.add(reg.athlete_id)
            // Increment per-sub-program enrollment count
            const prev = programData.subProgramEnrolled.get(subProgram.id) ?? 0
            programData.subProgramEnrolled.set(subProgram.id, prev + 1)
          }

          // Record sub-program price and capacity once per unique sub-program
          if (!programData.seenSubProgramIds.has(subProgram.id)) {
            programData.seenSubProgramIds.add(subProgram.id)
            const price = Number(subProgram.registration_fee || 0)
            if (price > 0) programData.subProgramPrices.push(price)
            if (subProgram.max_capacity) {
              programData.subProgramCapacity.set(subProgram.id, subProgram.max_capacity)
            }
          }
        }
      } else {
        log.warn('Registration has no program data', { reg })
      }
    })

    log.info('Programs Analytics - Grouped into programs', { count: programMap.size })

    // 3. Build program analytics
    const programsArray = Array.from(programMap.values())
    const programAnalytics: ProgramAnalytics[] = programsArray.map((programData) => {
      // Enrolled = confirmed + pending (excludes waitlisted)
      const currentEnrollment = programData.enrolledAthleteIds.size
      const waitlistedCount = programData.waitlistedAthleteIds.size

      // Total capacity = sum of all sub-programs that have a limit set
      const maxCapacity = programData.subProgramCapacity.size > 0
        ? Array.from(programData.subProgramCapacity.values()).reduce((sum, cap) => sum + cap, 0)
        : null

      // Enrollment rate = average fill rate across sub-programs that have a capacity set.
      // Sub-programs with no capacity limit are excluded from both numerator and denominator
      // so they don't inflate or deflate the rate.
      let enrollmentRate: number | null = null
      if (programData.subProgramCapacity.size > 0) {
        const rates = Array.from(programData.subProgramCapacity.entries()).map(([spId, cap]) => {
          const enrolled = programData.subProgramEnrolled.get(spId) ?? 0
          return enrolled / cap
        })
        enrollmentRate = Math.round(
          (rates.reduce((sum, r) => sum + r, 0) / rates.length) * 100
        )
      }

      const revenue = programData.registrations.reduce(
        (sum: number, reg: any) => sum + (revenueByReg[reg.id] || 0),
        0
      )

      const paidCount = programData.registrations.filter(
        (reg: any) => reg.payment_status === 'paid'
      ).length

      const unpaidCount = programData.registrations.length - paidCount

      // Average price across sub-programs
      const pricePerPerson = programData.subProgramPrices.length > 0
        ? programData.subProgramPrices.reduce((sum, price) => sum + price, 0) / programData.subProgramPrices.length
        : 0

      const avgRevenuePerAthlete = currentEnrollment > 0
        ? revenue / currentEnrollment
        : 0

      return {
        id: programData.id,
        name: programData.name,
        currentEnrollment,
        waitlistedCount,
        maxCapacity,
        enrollmentRate,
        revenue,
        paidCount,
        unpaidCount,
        pricePerPerson,
        avgRevenuePerAthlete,
      }
    })

    // Sort by name
    programAnalytics.sort((a, b) => a.name.localeCompare(b.name))

    // Check if we have any programs after filtering
    if (programAnalytics.length === 0) {
      return NextResponse.json({
        summary: {
          totalPrograms: 0,
          totalWaitlisted: 0,
          avgEnrollmentRate: null,
          mostPopularProgram: null,
          totalRevenue: 0,
          avgRevenuePerProgram: 0,
        },
        programs: [],
      })
    }

    // 4. Calculate summary metrics
    const totalPrograms = programAnalytics.length
    const totalWaitlisted = programAnalytics.reduce((sum, p) => sum + p.waitlistedCount, 0)
    const totalRevenue = programAnalytics.reduce((sum, p) => sum + p.revenue, 0)
    const avgRevenuePerProgram = totalPrograms > 0
      ? totalRevenue / totalPrograms
      : 0

    // Calculate average enrollment rate (only for programs with max capacity)
    const programsWithCapacity = programAnalytics.filter(p => p.maxCapacity !== null)
    const avgEnrollmentRate = programsWithCapacity.length > 0
      ? Math.round(
          programsWithCapacity.reduce((sum, p) => sum + (p.enrollmentRate || 0), 0) / 
          programsWithCapacity.length
        )
      : null

    // Find most popular program
    const mostPopular = programAnalytics.reduce(
      (max, p) => (p.currentEnrollment > max.currentEnrollment ? p : max),
      programAnalytics[0]
    )

    const mostPopularProgram = mostPopular
      ? {
          id: mostPopular.id,
          name: mostPopular.name,
          enrollment: mostPopular.currentEnrollment,
        }
      : null

    const summary: ProgramsSummary = {
      totalPrograms,
      totalWaitlisted,
      avgEnrollmentRate,
      mostPopularProgram,
      totalRevenue,
      avgRevenuePerProgram,
    }

    return NextResponse.json({
      summary,
      programs: programAnalytics,
    })
  } catch (error: any) {
    console.error('Programs analytics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load programs analytics' },
      { status: 500 }
    )
  }
}
