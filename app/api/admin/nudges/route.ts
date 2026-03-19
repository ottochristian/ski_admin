import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  const clubId = profile.club_id
  if (!clubId) return NextResponse.json({ nudges: [] })

  const admin = createSupabaseAdminClient()

  // Get active season
  const { data: season } = await admin
    .from('seasons')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .single()

  const seasonId = season?.id ?? null
  const nudges: any[] = []

  if (seasonId) {
    // ── Signal 1: Low waiver compliance per sub_program (<60%) ──────────────
    const { data: subPrograms } = await admin
      .from('sub_programs')
      .select('id, name, programs(id, name)')
      .eq('programs.club_id', clubId)
      .eq('programs.season_id', seasonId)
      .not('programs', 'is', null)

    if (subPrograms && subPrograms.length > 0) {
      const spIds = subPrograms.map((sp: any) => sp.id)

      // Include household_id so we can target specific families
      const { data: regCounts } = await admin
        .from('registrations')
        .select('sub_program_id, athlete_id, athletes(household_id)')
        .in('sub_program_id', spIds)
        .neq('status', 'cancelled')

      // Build athlete_id → household_id map
      const athleteToHousehold: Record<string, string> = {}
      for (const reg of regCounts ?? []) {
        const a = Array.isArray(reg.athletes) ? reg.athletes[0] : reg.athletes
        if (a?.household_id) athleteToHousehold[reg.athlete_id] = a.household_id
      }

      const { data: requiredWaivers } = await admin
        .from('waivers')
        .select('id')
        .eq('club_id', clubId)
        .eq('season_id', seasonId)
        .eq('is_required', true)

      if (requiredWaivers && requiredWaivers.length > 0) {
        const waiverIds = requiredWaivers.map((w: any) => w.id)

        const { data: signatures } = await admin
          .from('waiver_signatures')
          .select('athlete_id, waiver_id')
          .in('waiver_id', waiverIds)

        const signedSet = new Set((signatures ?? []).map((s: any) => s.athlete_id))

        // Group registrations by sub_program
        const bySubProgram: Record<string, string[]> = {}
        for (const reg of regCounts ?? []) {
          const key = reg.sub_program_id
          if (!bySubProgram[key]) bySubProgram[key] = []
          bySubProgram[key].push(reg.athlete_id)
        }

        for (const sp of subPrograms) {
          const athletes = bySubProgram[sp.id] ?? []
          if (athletes.length < 3) continue
          const signed = athletes.filter((id: string) => signedSet.has(id)).length
          const rate = Math.round((signed / athletes.length) * 100)
          if (rate < 60) {
            const missing = athletes.length - signed
            const unsignedAthleteIds = athletes.filter((id: string) => !signedSet.has(id))
            const householdIds = [...new Set(
              unsignedAthleteIds.map(id => athleteToHousehold[id]).filter(Boolean)
            )]
            const progName = (sp.programs as any)?.name ?? 'Unknown Program'
            nudges.push({
              id: `low-waiver-compliance-${sp.id}`,
              type: 'low_waiver_compliance',
              severity: rate < 30 ? 'red' : 'amber',
              title: `${progName} › ${sp.name} has ${rate}% waiver compliance`,
              detail: `${missing} of ${athletes.length} athletes haven't signed required waivers.`,
              send_target: { type: 'sub_program', id: sp.id, name: `${progName} › ${sp.name}` },
              recipient_count: householdIds.length,
              household_ids: householdIds,
              preview_names: [],
            })
          }
        }
      }
    }

    // ── Signal 2: Outstanding payments > 7 days per sub_program ──────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: unpaidRegs } = await admin
      .from('registrations')
      .select('id, athlete_id, sub_program_id, athletes(first_name, household_id), sub_programs(id, name, programs(name))')
      .eq('club_id', clubId)
      .eq('season_id', seasonId)
      .neq('payment_status', 'paid')
      .lte('created_at', sevenDaysAgo)
      .neq('status', 'cancelled')

    if (unpaidRegs && unpaidRegs.length > 0) {
      // Group by sub_program
      const unpaidBySubProgram: Record<string, any[]> = {}
      for (const reg of unpaidRegs) {
        const spId = reg.sub_program_id
        if (!spId) continue
        if (!unpaidBySubProgram[spId]) unpaidBySubProgram[spId] = []
        unpaidBySubProgram[spId].push(reg)
      }

      for (const [spId, regs] of Object.entries(unpaidBySubProgram)) {
        if (regs.length < 2) continue
        const sp = (regs[0].sub_programs as any)
        const prog = sp?.programs
        const spName = sp?.name ?? 'Unknown'
        const progName = prog?.name ?? 'Unknown'

        const householdIds = [...new Set(
          regs.map((r: any) => {
            const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
            return a?.household_id
          }).filter(Boolean) as string[]
        )]

        const previewNames = regs.slice(0, 4).map((r: any) => {
          const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
          return a?.first_name ?? 'Family'
        })

        nudges.push({
          id: `outstanding-payments-${spId}`,
          type: 'outstanding_payments',
          severity: householdIds.length >= 5 ? 'red' : 'amber',
          title: `${householdIds.length} ${householdIds.length === 1 ? 'family' : 'families'} in ${progName} › ${spName} haven't paid`,
          detail: `These registrations have been unpaid for over 7 days.`,
          send_target: { type: 'sub_program', id: spId, name: `${progName} › ${spName}` },
          recipient_count: householdIds.length,
          household_ids: householdIds,
          preview_names: previewNames,
        })
      }
    }
  }

  // ── Signal 3: Coach inactive (no messages in 14 days, has active groups) ──
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: coaches } = await admin
    .from('coaches')
    .select('id, profiles(id, first_name, last_name, email)')
    .eq('club_id', clubId)

  if (coaches && coaches.length > 0) {
    for (const coach of coaches) {
      const profile_data = Array.isArray(coach.profiles) ? coach.profiles[0] : coach.profiles as any
      if (!profile_data) continue

      const { count: assignmentCount } = await admin
        .from('coach_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coach.id)

      if (!assignmentCount || assignmentCount === 0) continue

      const { count: recentMessages } = await admin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', profile_data.id)
        .eq('club_id', clubId)
        .gte('created_at', fourteenDaysAgo)

      if (recentMessages === 0) {
        const coachName = [profile_data.first_name, profile_data.last_name].filter(Boolean).join(' ') || profile_data.email
        nudges.push({
          id: `coach-inactive-${coach.id}`,
          type: 'coach_inactive',
          severity: 'amber',
          title: `${coachName} hasn't sent any messages in 14+ days`,
          detail: `This coach has active assignments but hasn't communicated with families recently.`,
          send_target: null,
          recipient_count: 0,
          household_ids: [],
          preview_names: [],
          coach_name: coachName,
        })
      }
    }
  }

  return NextResponse.json({ nudges })
}
