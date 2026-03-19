import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const admin = createSupabaseAdminClient()

  // Get profile + verify coach role
  const { data: profile } = await admin
    .from('profiles')
    .select('id, club_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'coach' || !profile.club_id) {
    return NextResponse.json({ nudges: [] })
  }

  const clubId = profile.club_id

  // Get coach record
  const { data: coach } = await admin
    .from('coaches')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!coach) return NextResponse.json({ nudges: [] })

  // Get coach's group assignments
  const { data: assignments } = await admin
    .from('coach_assignments')
    .select('group_id, sub_program_id, groups(id, name), sub_programs(id, name)')
    .eq('coach_id', coach.id)

  const groupIds = (assignments ?? []).map((a: any) => a.group_id).filter(Boolean)
  const subProgramIds = (assignments ?? []).map((a: any) => a.sub_program_id).filter(Boolean)

  if (groupIds.length === 0 && subProgramIds.length === 0) {
    return NextResponse.json({ nudges: [] })
  }

  // Get active season
  const { data: season } = await admin
    .from('seasons')
    .select('id')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .single()

  const seasonId = season?.id ?? null
  const nudges: any[] = []

  // ── Signal 1: Unsigned waivers in coach's groups ────────────────────────
  if (seasonId && groupIds.length > 0) {
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
        .select('athlete_id')
        .in('waiver_id', waiverIds)
      const signedSet = new Set((signatures ?? []).map((s: any) => s.athlete_id))

      for (const assignment of assignments ?? []) {
        if (!assignment.group_id) continue
        const group = assignment.groups as any
        if (!group) continue

        const { data: regs } = await admin
          .from('registrations')
          .select('athlete_id, athletes(first_name, last_name, household_id)')
          .eq('group_id', assignment.group_id)
          .neq('status', 'cancelled')

        if (!regs || regs.length === 0) continue

        const unsigned = regs.filter((r: any) => !signedSet.has(r.athlete_id))
        if (unsigned.length === 0) continue

        const householdIds = [...new Set(
          unsigned.map((r: any) => {
            const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
            return a?.household_id
          }).filter(Boolean) as string[]
        )]

        const previewNames = unsigned.slice(0, 4).map((r: any) => {
          const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
          return a?.first_name ?? 'Athlete'
        })

        nudges.push({
          id: `unsigned-waivers-${assignment.group_id}`,
          type: 'unsigned_waivers',
          severity: unsigned.length >= 5 ? 'red' : 'amber',
          title: `${unsigned.length} athlete${unsigned.length === 1 ? '' : 's'} in ${group.name} haven't signed waivers`,
          detail: `These athletes need to sign required waivers before participating.`,
          send_target: { type: 'group', id: assignment.group_id, name: group.name },
          recipient_count: householdIds.length,
          household_ids: householdIds,
          preview_names: previewNames,
        })
      }
    }
  }

  // ── Signal 2: Outstanding payments in coach's groups ─────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const assignment of assignments ?? []) {
    if (!assignment.group_id) continue
    const group = assignment.groups as any
    if (!group) continue

    const { data: unpaid } = await admin
      .from('registrations')
      .select('athlete_id, athletes(first_name, household_id)')
      .eq('group_id', assignment.group_id)
      .neq('payment_status', 'paid')
      .lte('created_at', sevenDaysAgo)
      .neq('status', 'cancelled')

    if (!unpaid || unpaid.length < 2) continue

    const householdIds = [...new Set(
      unpaid.map((r: any) => {
        const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
        return a?.household_id
      }).filter(Boolean) as string[]
    )]

    const previewNames = unpaid.slice(0, 4).map((r: any) => {
      const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
      return a?.first_name ?? 'Athlete'
    })

    nudges.push({
      id: `unpaid-${assignment.group_id}`,
      type: 'outstanding_payments',
      severity: householdIds.length >= 5 ? 'red' : 'amber',
      title: `${householdIds.length} ${householdIds.length === 1 ? 'family' : 'families'} in ${group.name} have outstanding payments`,
      detail: `These registrations have been unpaid for over 7 days.`,
      send_target: { type: 'group', id: assignment.group_id, name: group.name },
      recipient_count: householdIds.length,
      household_ids: householdIds,
      preview_names: previewNames,
    })
  }

  // ── Signal 3: Event in next 48h ──────────────────────────────────────────
  const now = new Date().toISOString()
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  if (groupIds.length > 0) {
    const { data: upcomingEvents } = await admin
      .from('events')
      .select('id, title, start_at, sub_program_id')
      .eq('club_id', clubId)
      .gte('start_at', now)
      .lte('start_at', in48h)
      .order('start_at', { ascending: true })
      .limit(3)

    for (const event of upcomingEvents ?? []) {
      const dt = new Date(event.start_at).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })

      const matchingAssignment = (assignments ?? []).find((a: any) =>
        a.sub_program_id === event.sub_program_id
      )
      if (!matchingAssignment?.group_id) continue

      const group = matchingAssignment.groups as any

      // Fetch households in this group for the To: field pre-population
      const { data: eventRegs } = await admin
        .from('registrations')
        .select('athletes(household_id)')
        .eq('group_id', matchingAssignment.group_id)
        .neq('status', 'cancelled')

      const eventHouseholdIds = [...new Set(
        (eventRegs ?? []).map((r: any) => {
          const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
          return a?.household_id
        }).filter(Boolean) as string[]
      )]

      nudges.push({
        id: `event-${event.id}`,
        type: 'upcoming_event',
        severity: 'amber',
        title: `${event.title} is coming up`,
        detail: `Scheduled for ${dt}. Consider sending a reminder to families in ${group?.name ?? 'your group'}.`,
        send_target: { type: 'group', id: matchingAssignment.group_id, name: group?.name ?? 'Group' },
        recipient_count: eventHouseholdIds.length,
        household_ids: eventHouseholdIds,
        preview_names: [],
      })
    }
  }

  return NextResponse.json({ nudges })
}
