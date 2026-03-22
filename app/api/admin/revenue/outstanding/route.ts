import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

type ProfileRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type OutstandingPayment = {
  orderId: string
  householdName: string
  amount: number
  daysSinceCreated: number
  programs: string[]
  orderDate: string
  status: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get('seasonId')
  const requestedClubId = searchParams.get('clubId')
  const dateRange = searchParams.get('dateRange')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const programId = searchParams.get('programId')
  const status = searchParams.get('status')

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
    return NextResponse.json(
      { error: 'seasonId is required' },
      { status: 400 }
    )
  }

  if (!clubIdToUse) {
    return NextResponse.json(
      { error: 'clubId is required' },
      { status: 400 }
    )
  }

  if (!isSystemAdmin && clubIdToUse !== profile.club_id) {
    return NextResponse.json({ error: 'Forbidden: club mismatch' }, { status: 403 })
  }

  if (isSystemAdmin && !requestedClubId) {
    return NextResponse.json(
      { error: 'clubId is required for system admins' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Calculate date filter
  let dateFilterFrom: string | null = null
  let dateFilterTo: string | null = null
  
  if (dateRange === 'custom' && dateFrom) {
    dateFilterFrom = dateFrom
    dateFilterTo = dateTo || new Date().toISOString().split('T')[0]
  } else if (dateRange) {
    const now = new Date()
    if (dateRange === 'last-7') {
      dateFilterFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    } else if (dateRange === 'last-30') {
      dateFilterFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    } else if (dateRange === 'last-90') {
      dateFilterFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
    dateFilterTo = now.toISOString().split('T')[0]
  }

  // If programId filter is set, first get relevant order IDs
  let orderIdsFilter: string[] | null = null
  if (programId) {
    const { data: registrations } = await admin
      .from('registrations')
      .select(`
        id,
        sub_programs!inner(program_id)
      `)
      .eq('season_id', seasonId)
      .eq('sub_programs.program_id', programId)

    const registrationIds = (registrations || []).map((r: any) => r.id)
    
    if (registrationIds.length > 0) {
      const { data: orderItems } = await admin
        .from('order_items')
        .select('order_id')
        .in('registration_id', registrationIds)

      orderIdsFilter = [...new Set((orderItems || []).map((oi: any) => oi.order_id))]
    } else {
      orderIdsFilter = []
    }
  }

  // Get unpaid and partially_paid orders
  let ordersQuery = admin
    .from('orders')
    .select(`
      id,
      household_id,
      total_amount,
      status,
      created_at,
      season_id,
      seasons!inner(club_id)
    `)
    .eq('season_id', seasonId)
    .eq('seasons.club_id', clubIdToUse)
    .in('status', ['unpaid', 'partially_paid'])
    .order('created_at', { ascending: false })

  // Apply program filter
  if (orderIdsFilter !== null) {
    if (orderIdsFilter.length === 0) {
      return NextResponse.json({ outstanding: [] })
    }
    ordersQuery = ordersQuery.in('id', orderIdsFilter)
  }

  // Apply date filter
  if (dateFilterFrom) {
    ordersQuery = ordersQuery.gte('created_at', dateFilterFrom)
  }
  if (dateFilterTo) {
    ordersQuery = ordersQuery.lte('created_at', dateFilterTo + 'T23:59:59')
  }

  const { data: orders, error: ordersError } = await ordersQuery

  if (ordersError) {
    console.error('Outstanding orders error:', ordersError)
    return NextResponse.json(
      { error: ordersError.message || 'Failed to load outstanding orders' },
      { status: 500 }
    )
  }

  // Get household names from primary guardian's profile (households have no name column)
  const householdIds = (orders || []).map((o: any) => o.household_id).filter(Boolean)
  const householdMap = new Map<string, string>()

  if (householdIds.length > 0) {
    const { data: guardians } = await admin
      .from('household_guardians')
      .select('household_id, profiles!inner(first_name, last_name)')
      .in('household_id', householdIds)

    // Use the first guardian found per household as the display name
    ;(guardians || []).forEach((g: any) => {
      if (!householdMap.has(g.household_id)) {
        const first = g.profiles?.first_name || ''
        const last = g.profiles?.last_name || ''
        const name = [first, last].filter(Boolean).join(' ')
        if (name) householdMap.set(g.household_id, `${last} Family`)
      }
    })
  }

  // Get program names for each order
  const orderIds = (orders || []).map((o: any) => o.id)
  const orderProgramsMap = new Map<string, string[]>()
  
  if (orderIds.length > 0) {
    const { data: orderItems } = await admin
      .from('order_items')
      .select(`
        order_id,
        registrations!inner(
          id,
          sub_programs!inner(
            id,
            programs!inner(name)
          )
        )
      `)
      .in('order_id', orderIds)

    ;(orderItems || []).forEach((item: any) => {
      const orderId = item.order_id
      const programName = item.registrations?.sub_programs?.programs?.name
      
      if (programName) {
        if (!orderProgramsMap.has(orderId)) {
          orderProgramsMap.set(orderId, [])
        }
        const programs = orderProgramsMap.get(orderId)!
        if (!programs.includes(programName)) {
          programs.push(programName)
        }
      }
    })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ outstanding: [] })
  }

  const now = new Date()
  const outstanding: OutstandingPayment[] = (orders || []).map((order: any) => {
    const createdAt = new Date(order.created_at)
    const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    return {
      orderId: order.id,
      householdName: householdMap.get(order.household_id) || 'Unknown Household',
      amount: Number(order.total_amount || 0),
      daysSinceCreated,
      programs: orderProgramsMap.get(order.id) || [],
      orderDate: createdAt.toISOString().split('T')[0],
      status: order.status,
    }
  })

  return NextResponse.json({ outstanding })
}
