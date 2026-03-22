import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { log } from '@/lib/logger'
import { createRegistrationSchema, ValidationError } from '@/lib/validation'
import { z } from 'zod'

/**
 * API route to create registrations for parent checkout
 * Uses admin client to bypass RLS, but verifies user owns the athletes
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      log.warn('Authentication failed in create registrations API', {
        status: authResult.status,
        hasCookies: request.cookies.getAll().length > 0,
        cookieNames: request.cookies.getAll().map((c: { name: string }) => c.name),
      })
      return authResult
    }

    const { user } = authResult
    log.info('User authenticated for registration creation', { userId: user.id })
    const adminSupabase = createSupabaseAdminClient()

    // 2. Parse request body
    // Validate request body
    let validatedData: { registrations: Record<string, unknown>[]; clubId: string }
    try {
      const rawBody = await request.json()
      validatedData = createRegistrationSchema.parse(rawBody)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            validationErrors: error.issues.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { registrations: rawRegistrations, clubId } = validatedData
    type RegistrationRow = { athlete_id: string; sub_program_id: string; season_id?: string; season?: string; status?: string; club_id?: string; notes?: string }

    // Look up season name from season_id so we can satisfy the NOT NULL season column
    const seasonId = rawRegistrations[0]?.season_id
    let seasonName: string | undefined
    if (seasonId) {
      const { data: seasonData } = await adminSupabase
        .from('seasons')
        .select('name')
        .eq('id', seasonId)
        .single()
      seasonName = seasonData?.name
    }

    const registrations = rawRegistrations.map((r) => ({
      athlete_id: r.athlete_id,
      sub_program_id: r.sub_program_id,
      season_id: r.season_id,
      season: seasonName,
      status: r.status ?? 'pending',
      club_id: r.club_id,
    } as RegistrationRow))

    // 3. Verify user is linked to household
    const { data: householdGuardian } = await adminSupabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!householdGuardian) {
      log.warn('User attempted to create registration without household link', {
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'No household found. Please contact support.' },
        { status: 403 }
      )
    }

    // 4. Verify user owns all athletes they're trying to register
    const uniqueAthleteIds = [...new Set(registrations.map((r: { athlete_id: string }) => r.athlete_id))]
    const athleteIds = uniqueAthleteIds
    const householdId = householdGuardian.household_id

    log.info('Checking athlete ownership', {
      userId: user.id,
      athleteIds,
      householdId,
      clubId,
    })

    // First, let's check what athletes actually exist and their current links
    const { data: allRequestedAthletes, error: fetchError } = await adminSupabase
      .from('athletes')
      .select('id, household_id, club_id')
      .in('id', athleteIds)

    if (fetchError) {
      log.error('Error fetching athletes for ownership check', fetchError, {
        userId: user.id,
        athleteIds,
      })
      return NextResponse.json(
        { error: `Error verifying athlete ownership: ${fetchError.message}` },
        { status: 500 }
      )
    }

    type AthleteRecord = { id: string; household_id: string; club_id: string }

    log.info('Found requested athletes', {
      athleteIds,
      foundAthletes: allRequestedAthletes?.map((a: AthleteRecord) => ({
        id: a.id,
        household_id: a.household_id,
        club_id: a.club_id,
      })),
    })

    // Verify all athletes belong to user's household
    // (Club is enforced via program → season → club foreign keys; household ownership is the security boundary)
    const matchingAthletes = allRequestedAthletes?.filter((athlete: AthleteRecord) =>
      athlete.household_id === householdId
    ) || []

    log.info('Athlete ownership check result', {
      requestedCount: athleteIds.length,
      foundCount: allRequestedAthletes?.length || 0,
      matchingCount: matchingAthletes.length,
      householdId,
      matchingAthleteIds: matchingAthletes.map((a: AthleteRecord) => a.id),
    })

    if (matchingAthletes.length !== athleteIds.length) {
      const missingAthleteIds = athleteIds.filter(
        (id) => !matchingAthletes.some((a: AthleteRecord) => a.id === id)
      )

      log.warn('User attempted to register athletes they do not own', {
        userId: user.id,
        householdId,
        athleteIds,
        missingAthleteIds,
      })

      return NextResponse.json(
        { error: 'You can only register athletes that belong to your household.' },
        { status: 403 }
      )
    }

    // 5. Deduplicate: skip any registrations where an active/waitlisted entry already exists
    const regSeasonId = registrations[0]?.season_id ?? ''
    const athleteSubProgramPairs = registrations.map((r: RegistrationRow) => ({
      athlete_id: r.athlete_id,
      sub_program_id: r.sub_program_id,
    }))

    const { data: existingRows } = await adminSupabase
      .from('registrations')
      .select('athlete_id, sub_program_id, status')
      .eq('season_id', regSeasonId)
      .in('status', ['confirmed', 'pending', 'waitlisted'])
      .in('athlete_id', athleteSubProgramPairs.map((p: { athlete_id: string }) => p.athlete_id))
      .in('sub_program_id', athleteSubProgramPairs.map((p: { sub_program_id: string }) => p.sub_program_id))

    const existingKeys = new Set(
      (existingRows ?? []).map((r: { athlete_id: string; sub_program_id: string }) =>
        `${r.athlete_id}::${r.sub_program_id}`
      )
    )

    const deduped = registrations.filter((r: RegistrationRow) =>
      !existingKeys.has(`${r.athlete_id}::${r.sub_program_id}`)
    )

    if (deduped.length === 0) {
      log.info('All registrations already exist, returning empty', { userId: user.id })
      return NextResponse.json({ registrations: [] }, { status: 201 })
    }

    const registrations_to_insert = deduped

    // 6. Enforce capacity: for each registration with status 'pending',
    //    check current enrollment and downgrade to 'waitlisted' if at capacity.
    const subProgramIds = [...new Set(registrations_to_insert.map((r: RegistrationRow) => r.sub_program_id))]

    // Fetch sub-program capacities
    const { data: subPrograms } = await adminSupabase
      .from('sub_programs')
      .select('id, max_capacity')
      .in('id', subProgramIds)

    // Count current confirmed/pending (not waitlisted) registrations per sub-program
    const { data: enrollmentRows } = await adminSupabase
      .from('registrations')
      .select('sub_program_id')
      .in('sub_program_id', subProgramIds)
      .eq('season_id', regSeasonId)
      .in('status', ['confirmed', 'pending'])

    const enrollmentCount: Record<string, number> = {}
    for (const row of enrollmentRows ?? []) {
      enrollmentCount[row.sub_program_id] = (enrollmentCount[row.sub_program_id] ?? 0) + 1
    }

    const capacityMap: Record<string, number | null> = {}
    for (const sp of subPrograms ?? []) {
      capacityMap[sp.id] = sp.max_capacity ?? null
    }

    // Resolve final status per registration
    const registrationsWithStatus = registrations_to_insert.map((r: RegistrationRow) => {
      // If caller already set waitlisted, keep it
      if (r.status === 'waitlisted') return r
      const capacity = capacityMap[r.sub_program_id]
      if (capacity == null) return r // no limit
      const current = enrollmentCount[r.sub_program_id] ?? 0
      if (current >= capacity) {
        return { ...r, status: 'waitlisted' }
      }
      // Increment count so subsequent registrations in this same batch are also checked
      enrollmentCount[r.sub_program_id] = current + 1
      return r
    })

    log.info('Capacity check complete', {
      userId: user.id,
      enrollmentCount,
      waitlistedCount: registrationsWithStatus.filter((r: RegistrationRow) => r.status === 'waitlisted').length,
    })

    // 6. Create registrations (using admin client to bypass RLS)
    const { data: createdRegistrations, error: createError } = await adminSupabase
      .from('registrations')
      .insert(registrationsWithStatus)
      .select()

    if (createError || !createdRegistrations) {
      log.error('Error creating registrations', createError, {
        userId: user.id,
        registrations,
      })
      return NextResponse.json(
        { error: createError?.message || 'Failed to create registrations' },
        { status: 500 }
      )
    }

    log.info('Registrations created successfully', {
      userId: user.id,
      count: createdRegistrations.length,
      registrationIds: createdRegistrations.map((r: { id: string }) => r.id),
    })

    return NextResponse.json({ registrations: createdRegistrations }, { status: 201 })
  } catch (err) {
    log.error('Error in create registrations API', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}




