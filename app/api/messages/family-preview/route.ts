import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const PREVIEW_LIMIT = 8

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { searchParams } = new URL(request.url)
  const targetType = searchParams.get('target_type') as 'program' | 'sub_program' | 'group' | null
  const targetId = searchParams.get('target_id')

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'target_type and target_id required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['coach', 'admin', 'system_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()

  // Resolve household_ids (same logic as recipient-count)
  let householdIds: string[] = []

  if (targetType === 'group') {
    const { data: regs } = await admin
      .from('registrations')
      .select('athletes(household_id)')
      .eq('group_id', targetId)
    householdIds = extractHouseholdIds(regs)
  } else if (targetType === 'sub_program') {
    const { data: regs } = await admin
      .from('registrations')
      .select('athletes(household_id)')
      .eq('sub_program_id', targetId)
    householdIds = extractHouseholdIds(regs)
  } else {
    const { data: sps } = await admin
      .from('sub_programs')
      .select('id')
      .eq('program_id', targetId)
    const spIds = sps?.map((s: { id: string }) => s.id) ?? []
    if (spIds.length > 0) {
      const { data: regs } = await admin
        .from('registrations')
        .select('athletes(household_id)')
        .in('sub_program_id', spIds)
      householdIds = extractHouseholdIds(regs)
    }
  }

  if (householdIds.length === 0) {
    return NextResponse.json({ families: [] })
  }

  // Fetch household last names (up to PREVIEW_LIMIT)
  const { data: households } = await admin
    .from('households')
    .select('last_name')
    .in('id', householdIds.slice(0, PREVIEW_LIMIT))
    .order('last_name')

  const families = (households ?? [])
    .map((h: { last_name: string | null }) => h.last_name)
    .filter(Boolean)
    .map((name: string) => `${name} family`)

  return NextResponse.json({ families })
}

function extractHouseholdIds(regs: any[] | null): string[] {
  if (!regs) return []
  const ids = regs.map((r) => {
    const athlete = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
    return athlete?.household_id
  })
  return [...new Set(ids.filter(Boolean) as string[])]
}
