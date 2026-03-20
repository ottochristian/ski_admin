import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { getAthleteCategory, FIS_DEFAULT_CATEGORIES, type AgeCalculationMethod, type AgeCategory } from '@/lib/ski-categories'

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  const clubId = profile.club_id
  if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 })

  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const search = searchParams.get('q')?.trim() ?? ''
  const seasonId = searchParams.get('season_id') ?? null

  const admin = createSupabaseAdminClient()

  // Fetch club age category settings
  const { data: clubRow } = await admin
    .from('clubs')
    .select('age_calculation_method, age_categories')
    .eq('id', clubId)
    .single()
  const ageMethod: AgeCalculationMethod = (clubRow?.age_calculation_method as AgeCalculationMethod) ?? 'fis_competition_year'
  const ageCategories: AgeCategory[] = (clubRow?.age_categories as AgeCategory[]) ?? FIS_DEFAULT_CATEGORIES

  // Count total
  let countQ = admin
    .from('athletes')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
  if (search.length >= 2) {
    countQ = countQ.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }
  const { count } = await countQ
  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Fetch athletes (paginated)
  let athleteQ = admin
    .from('athletes')
    .select('id, first_name, last_name, date_of_birth, household_id')
    .eq('club_id', clubId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (search.length >= 2) {
    athleteQ = athleteQ.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }
  const { data: athletes } = await athleteQ
  if (!athletes?.length) return NextResponse.json({ athletes: [], totalCount, totalPages, currentPage: page })

  const athleteIds = athletes.map((a: any) => a.id)
  const householdIds = [...new Set(athletes.map((a: any) => a.household_id).filter(Boolean) as string[])]

  // Registrations for current season
  let regQ = admin
    .from('registrations')
    .select(`
      id, athlete_id, payment_status,
      sub_programs(id, name, programs(id, name))
    `)
    .in('athlete_id', athleteIds)
  if (seasonId) regQ = regQ.eq('season_id', seasonId)
  const { data: regs } = await regQ

  // Waivers for current season
  let waiverMap: Record<string, boolean> = {}
  if (seasonId && athleteIds.length > 0) {
    const { data: waiverRows } = await admin
      .from('waiver_signatures')
      .select('athlete_id')
      .in('athlete_id', athleteIds)
      .eq('season_id', seasonId)
    const signed = new Set(waiverRows?.map((w: any) => w.athlete_id) ?? [])
    for (const id of athleteIds) waiverMap[id] = signed.has(id)
  }

  // Guardians: name + phone
  let guardiansByHousehold: Record<string, { name: string; phone: string | null }> = {}
  if (householdIds.length > 0) {
    const { data: guardians } = await admin
      .from('household_guardians')
      .select('household_id, profiles(first_name, last_name, phone)')
      .in('household_id', householdIds)
      .order('created_at', { ascending: true })

    for (const g of guardians ?? []) {
      if (guardiansByHousehold[g.household_id]) continue // take first guardian only
      const p = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles
      if (!p) continue
      guardiansByHousehold[g.household_id] = {
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || '',
        phone: (p as any).phone ?? null,
      }
    }
  }

  // Build reg lookup: athlete_id → best reg (prefer current season)
  const regByAthlete: Record<string, any> = {}
  for (const r of regs ?? []) {
    regByAthlete[r.athlete_id] = r
  }

  const result = (athletes as any[]).map(a => {
    const reg = regByAthlete[a.id]
    const sp = reg ? (Array.isArray(reg.sub_programs) ? reg.sub_programs[0] : reg.sub_programs) : null
    const prog = sp ? (Array.isArray(sp.programs) ? sp.programs[0] : sp.programs) : null
    const guardian = a.household_id ? guardiansByHousehold[a.household_id] ?? null : null

    const categoryInfo = a.date_of_birth
      ? getAthleteCategory(a.date_of_birth, ageMethod, ageCategories)
      : null

    return {
      id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      category: categoryInfo?.category ?? null,
      program_name: prog?.name ?? null,
      sub_program_name: sp?.name ?? null,
      payment_status: reg?.payment_status ?? null,
      waiver_signed: seasonId ? (waiverMap[a.id] ?? false) : null,
      guardian_name: guardian?.name ?? null,
      guardian_phone: guardian?.phone ?? null,
    }
  })

  return NextResponse.json({ athletes: result, totalCount, totalPages, currentPage: page })
}
