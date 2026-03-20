import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

type ProfileRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type RevenuePoint = {
  date: string // YYYY-MM-DD
  paidAmount: number
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

  if (!clubIdToUse) {
    return NextResponse.json({ error: 'clubId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Revenue timeseries from paid orders — the authoritative Stripe-backed source
  const { data, error } = await admin
    .from('orders')
    .select('total_amount, created_at')
    .eq('club_id', clubIdToUse)
    .eq('season_id', seasonId)
    .eq('status', 'paid')

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to load revenue timeseries' }, { status: 500 })
  }

  const points = new Map<string, number>()

  ;(data || []).forEach((row: any) => {
    const date = new Date(row.created_at)
    if (Number.isNaN(date.getTime())) return
    const key = date.toISOString().slice(0, 10)
    points.set(key, (points.get(key) || 0) + Number(row.total_amount || 0))
  })

  const timeseries: RevenuePoint[] = Array.from(points.entries())
    .map(([date, paidAmount]) => ({ date, paidAmount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ timeseries })
}
