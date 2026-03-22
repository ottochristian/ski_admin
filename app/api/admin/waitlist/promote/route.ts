import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { log } from '@/lib/logger'
import { notificationService } from '@/lib/services/notification-service'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/admin/waitlist/promote
 * Promotes waitlisted athletes to 'pending' when spots are available (FIFO).
 * Called after capacity increases or registration cancellations.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const body = await request.json()
    const { subProgramId, seasonId } = body as { subProgramId: string; seasonId: string }

    if (!subProgramId || !seasonId) {
      return NextResponse.json({ error: 'subProgramId and seasonId are required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()

    // Verify caller is admin for the club that owns this sub-program
    const { data: sp } = await supabase
      .from('sub_programs')
      .select('id, name, programs!inner(id, name, club_id, seasons!inner(id, name))')
      .eq('id', subProgramId)
      .single()

    if (!sp) {
      return NextResponse.json({ error: 'Sub-program not found' }, { status: 404 })
    }

    const program = sp.programs as unknown as { id: string; name: string; club_id: string; seasons: { id: string; name: string } }
    const clubId = program.club_id

    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('role, club_id')
      .eq('id', user.id)
      .single()

    const isAdmin = adminCheck?.role === 'admin' || adminCheck?.role === 'master_admin'
    const isClubAdmin = adminCheck?.club_id === clubId || adminCheck?.role === 'master_admin'

    if (!isAdmin || !isClubAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch club for branding
    const { data: club } = await supabase
      .from('clubs')
      .select('id, name, slug')
      .eq('id', clubId)
      .single()

    // Call the DB function — atomically promotes oldest waitlisted registrations
    const { data: promoted, error: promoteError } = await supabase
      .rpc('promote_from_waitlist', {
        p_sub_program_id: subProgramId,
        p_season_id: seasonId,
      })

    if (promoteError) {
      log.error('promote_from_waitlist RPC error', promoteError, { subProgramId, seasonId })
      return NextResponse.json({ error: promoteError.message }, { status: 500 })
    }

    const promotedRows = promoted as { registration_id: string; athlete_id: string; household_id: string }[]

    if (!promotedRows || promotedRows.length === 0) {
      log.info('No waitlisted registrations to promote', { subProgramId, seasonId })
      return NextResponse.json({ promoted: 0 })
    }

    log.info('Promoted waitlisted registrations', {
      subProgramId,
      seasonId,
      promotedCount: promotedRows.length,
      adminUserId: user.id,
    })

    // Fetch athlete names for all promoted registrations
    const athleteIds = [...new Set(promotedRows.map((r) => r.athlete_id))]
    const { data: athleteRows } = await supabase
      .from('athletes')
      .select('id, first_name, last_name')
      .in('id', athleteIds)

    type AthleteRow = { id: string; first_name: string; last_name: string }
    const athleteMap = new Map<string, string>(
      (athleteRows ?? []).map((a: AthleteRow) => [a.id, `${a.first_name} ${a.last_name}`] as [string, string])
    )

    // Fetch guardian emails for affected households
    const householdIds = [...new Set(promotedRows.map((r) => r.household_id))]
    const { data: guardianRows } = await supabase
      .from('household_guardians')
      .select('household_id, profiles!inner(email, first_name)')
      .in('household_id', householdIds)
      .eq('is_primary', true)

    // Build a map of household_id → { email, first_name }
    type GuardianInfo = { email: string; first_name: string | null }
    const guardianMap = new Map<string, GuardianInfo>()
    for (const row of guardianRows ?? []) {
      const profiles = row.profiles as unknown as { email: string; first_name: string | null }
      if (!guardianMap.has(row.household_id)) {
        guardianMap.set(row.household_id, {
          email: profiles.email,
          first_name: profiles.first_name,
        })
      }
    }

    const clubSlug = club?.slug ?? ''
    const dashboardUrl = `${BASE_URL}/clubs/${clubSlug}/parent/dashboard`

    // Send one email per household (may have multiple athletes promoted)
    const householdAthletes = new Map<string, string[]>()
    for (const row of promotedRows) {
      const name = athleteMap.get(row.athlete_id) ?? 'Your athlete'
      const list = householdAthletes.get(row.household_id) ?? []
      list.push(name)
      householdAthletes.set(row.household_id, list)
    }

    const emailResults = await Promise.allSettled(
      Array.from(householdAthletes.entries()).map(async ([householdId, athleteNames]) => {
        const guardian = guardianMap.get(householdId)
        if (!guardian?.email) return

        const greeting = guardian.first_name ? `Hi ${guardian.first_name},` : 'Hello,'
        const athleteList = athleteNames.map((n) => `  • ${n}`).join('\n')
        const programLabel = `${program.name} — ${sp.name}`

        const message = `${greeting}

Great news — a spot has opened up!

The following athlete${athleteNames.length > 1 ? 's have' : ' has'} been moved from the waitlist and ${athleteNames.length > 1 ? 'are' : 'is'} now registered (pending payment) for ${programLabel}:

${athleteList}

To complete your registration, please log in and pay within 48 hours. If payment is not received, the spot will be offered to the next family on the waitlist.

Complete your registration:
${dashboardUrl}

If you have any questions, please contact your club directly.

Thanks,
The ${club?.name ?? 'Club'} Team`.trim()

        await notificationService.send({
          method: 'email',
          recipient: guardian.email,
          subject: `Spot available — ${programLabel} (${club?.name ?? ''})`,
          message,
        })
      })
    )

    const emailsFailed = emailResults.filter((r) => r.status === 'rejected').length
    if (emailsFailed > 0) {
      log.warn('Some waitlist promotion emails failed', { emailsFailed, total: emailResults.length })
    }

    return NextResponse.json({
      promoted: promotedRows.length,
      emailsSent: emailResults.length - emailsFailed,
    })
  } catch (err) {
    log.error('Error in waitlist promote API', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
