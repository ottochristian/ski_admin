import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

type ProfileRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type ProgramAnalytics = {
  id: string
  name: string
  currentEnrollment: number
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
        payment_status,
        sub_programs!inner(
          id,
          program_id,
          price,
          max_participants,
          programs!inner(
            id,
            name,
            status
          )
        )
      `)
      .eq('season_id', seasonId)
      .eq('club_id', clubIdToUse)

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
      subProgramCapacities: number[]
      status: string
      registrations: any[]
      athleteIds: Set<string>
    }>()

    registrations.forEach((reg: any) => {
      const subProgram = reg.sub_programs
      const program = subProgram?.programs
      
      if (program && subProgram) {
        log.debug('Program found', { name: program.name, status: program.status })
        if (program.status === 'active' || program.status === 'full') {
          if (!programMap.has(program.id)) {
            programMap.set(program.id, {
              id: program.id,
              name: program.name,
              subProgramPrices: [],
              subProgramCapacities: [],
              status: program.status,
              registrations: [],
              athleteIds: new Set(),
            })
          }
          const programData = programMap.get(program.id)!
          programData.registrations.push(reg)
          programData.athleteIds.add(reg.athlete_id)
          
          // Track sub-program prices and capacities for aggregation
          const price = Number(subProgram.price || 0)
          const capacity = subProgram.max_participants
          
          if (price > 0 && !programData.subProgramPrices.includes(price)) {
            programData.subProgramPrices.push(price)
          }
          if (capacity && !programData.subProgramCapacities.includes(capacity)) {
            programData.subProgramCapacities.push(capacity)
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
      const currentEnrollment = programData.athleteIds.size
      
      // Sum all sub-program capacities for total capacity
      const maxCapacity = programData.subProgramCapacities.length > 0
        ? programData.subProgramCapacities.reduce((sum, cap) => sum + cap, 0)
        : null

      const enrollmentRate = maxCapacity 
        ? Math.round((currentEnrollment / maxCapacity) * 100)
        : null

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
