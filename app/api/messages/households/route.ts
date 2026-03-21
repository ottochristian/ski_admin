import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const MAX_HOUSEHOLDS = 100

const postSchema = z.union([
  z.object({
    household_ids: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    target_type: z.enum(['program', 'sub_program', 'group']),
    target_id: z.string().uuid(),
  }),
])

// GET /api/messages/households?q=Smith — search households by last name (scoped to user's club)
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['coach', 'admin', 'system_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ households: [] })

  const admin = createSupabaseAdminClient()

  // First: get all household IDs that have athletes in this club
  const { data: athleteRows } = await admin
    .from('athletes')
    .select('household_id')
    .eq('club_id', profile.club_id)

  const clubHouseholdIds = [...new Set(
    (athleteRows ?? []).map((a: { household_id: string | null }) => a.household_id).filter(Boolean) as string[]
  )]

  if (clubHouseholdIds.length === 0) return NextResponse.json({ households: [] })

  // Search by last_name OR guardian email, scoped to club households
  const [{ data: nameRows }, { data: emailGuardianRows }] = await Promise.all([
    // Match by household last_name
    admin
      .from('households')
      .select('id, last_name')
      .in('id', clubHouseholdIds)
      .ilike('last_name', `%${q}%`)
      .order('last_name')
      .limit(10),
    // Match by guardian profile email
    admin
      .from('profiles')
      .select('id, email, first_name, last_name, household_guardians!inner(household_id)')
      .ilike('email', `%${q}%`)
      .limit(20),
  ])

  // Collect household IDs matched by email, filtered to club scope
  const emailMatchedHouseholdIds = new Set<string>()
  for (const p of emailGuardianRows ?? []) {
    const hgs = Array.isArray(p.household_guardians) ? p.household_guardians : [p.household_guardians]
    for (const hg of hgs) {
      if (hg?.household_id && clubHouseholdIds.includes(hg.household_id)) {
        emailMatchedHouseholdIds.add(hg.household_id)
      }
    }
  }

  // Merge: start with name matches, add email matches not already included
  const seen = new Set<string>()
  const households: { id: string; name: string }[] = []

  for (const h of nameRows ?? []) {
    if (seen.has(h.id)) continue
    seen.add(h.id)
    households.push({ id: h.id, name: h.last_name ? `${h.last_name} family` : 'Unknown family' })
  }

  if (emailMatchedHouseholdIds.size > 0) {
    const extraIds = [...emailMatchedHouseholdIds].filter(id => !seen.has(id))
    if (extraIds.length > 0) {
      const { data: extraRows } = await admin
        .from('households')
        .select('id, last_name')
        .in('id', extraIds)
        .order('last_name')
      for (const h of extraRows ?? []) {
        if (seen.has(h.id)) continue
        seen.add(h.id)
        households.push({ id: h.id, name: h.last_name ? `${h.last_name} family` : 'Unknown family' })
      }
    }
  }

  return NextResponse.json({ households: households.slice(0, 10) })
}

function extractHouseholdIds(regs: any[] | null): string[] {
  if (!regs) return []
  const ids = regs.map((r) => {
    const athlete = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
    return athlete?.household_id
  })
  return [...new Set(ids.filter(Boolean) as string[])]
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['coach', 'admin', 'system_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedBody = postSchema.safeParse(raw)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Provide either household_ids or target_type + target_id' },
      { status: 400 }
    )
  }

  const body = parsedBody.data
  const admin = createSupabaseAdminClient()

  // Branch 1: explicit household_ids — just resolve their names
  if ('household_ids' in body) {
    const rawIds: string[] = body.household_ids.slice(0, MAX_HOUSEHOLDS)
    if (rawIds.length === 0) {
      return NextResponse.json({ households: [] })
    }

    const { data: rows } = await admin
      .from('households')
      .select('id, last_name')
      .in('id', rawIds)
      .order('last_name')

    let households = (rows ?? []).map((h: { id: string; last_name: string | null }) => ({
      id: h.id,
      name: h.last_name ? `${h.last_name} family` : 'Unknown family',
    }))

    // Fallback: if households table has no matching rows (data gap), derive names from athletes
    if (households.length === 0) {
      const { data: athleteRows } = await admin
        .from('athletes')
        .select('household_id, last_name')
        .in('household_id', rawIds)
        .order('last_name')

      const seen = new Set<string>()
      households = []
      for (const a of athleteRows ?? []) {
        if (!a.household_id || seen.has(a.household_id)) continue
        seen.add(a.household_id)
        households.push({
          id: a.household_id,
          name: a.last_name ? `${a.last_name} family` : 'Unknown family',
        })
      }
    }

    return NextResponse.json({ households })
  }

  // Branch 2: target_type + target_id — resolve households in that target
  if ('target_type' in body) {
    const { target_type: targetType, target_id: targetId } = body

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
      // program — find sub_programs first
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
      return NextResponse.json({ households: [] })
    }

    const slicedIds = householdIds.slice(0, MAX_HOUSEHOLDS)
    const { data: rows } = await admin
      .from('households')
      .select('id, last_name')
      .in('id', slicedIds)
      .order('last_name')

    let households = (rows ?? []).map((h: { id: string; last_name: string | null }) => ({
      id: h.id,
      name: h.last_name ? `${h.last_name} family` : 'Unknown family',
    }))

    // Fallback: derive names from athletes if households table has no matching rows
    if (households.length === 0) {
      const { data: athleteRows } = await admin
        .from('athletes')
        .select('household_id, last_name')
        .in('household_id', slicedIds)
        .order('last_name')

      const seen = new Set<string>()
      households = []
      for (const a of athleteRows ?? []) {
        if (!a.household_id || seen.has(a.household_id)) continue
        seen.add(a.household_id)
        households.push({
          id: a.household_id,
          name: a.last_name ? `${a.last_name} family` : 'Unknown family',
        })
      }
    }

    return NextResponse.json({ households })
  }

  return NextResponse.json(
    { error: 'Provide either household_ids or target_type + target_id' },
    { status: 400 }
  )
}
