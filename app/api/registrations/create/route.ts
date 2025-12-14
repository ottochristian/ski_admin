import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { log } from '@/lib/logger'

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
    const body = await request.json()
    const { registrations, clubId } = body

    if (!Array.isArray(registrations) || registrations.length === 0) {
      return NextResponse.json(
        { error: 'Invalid registrations data' },
        { status: 400 }
      )
    }

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    // 3. Verify user is linked to household or family
    const { data: householdGuardian } = await adminSupabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Get family_id if using legacy families table
    const { data: family } = await adminSupabase
      .from('families')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!householdGuardian && !family) {
      log.warn('User attempted to create registration without household or family link', {
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'No household found. Please contact support.' },
        { status: 403 }
      )
    }

    // 4. Verify user owns all athletes they're trying to register
    const athleteIds = registrations.map((r: any) => r.athlete_id)
    const householdId = householdGuardian?.household_id
    const familyId = family?.id

    log.info('Checking athlete ownership', {
      userId: user.id,
      athleteIds,
      householdId,
      familyId,
      clubId,
    })

    // First, let's check what athletes actually exist and their current links
    const { data: allRequestedAthletes, error: fetchError } = await adminSupabase
      .from('athletes')
      .select('id, household_id, family_id, club_id')
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

    log.info('Found requested athletes', {
      athleteIds,
      foundAthletes: allRequestedAthletes?.map((a: any) => ({
        id: a.id,
        household_id: a.household_id,
        family_id: a.family_id,
        club_id: a.club_id,
      })),
    })

    // Verify all athletes belong to user's household or family AND the correct club
    const matchingAthletes = allRequestedAthletes?.filter((athlete: any) => {
      const householdMatch = householdId && athlete.household_id === householdId
      const familyMatch = familyId && athlete.family_id === familyId
      const clubMatch = athlete.club_id === clubId
      
      // Athlete must belong to user's household/family AND the correct club
      return clubMatch && (householdMatch || familyMatch)
    }) || []

    log.info('Athlete ownership check result', {
      requestedCount: athleteIds.length,
      foundCount: allRequestedAthletes?.length || 0,
      matchingCount: matchingAthletes.length,
      householdId,
      familyId,
      matchingAthleteIds: matchingAthletes.map((a: any) => a.id),
    })

    if (matchingAthletes.length !== athleteIds.length) {
      const missingAthleteIds = athleteIds.filter(
        (id) => !matchingAthletes.some((a: any) => a.id === id)
      )
      
      log.warn('User attempted to register athletes they do not own', {
        userId: user.id,
        athleteIds,
        missingAthleteIds,
        foundAthletes: matchingAthletes.map((a: any) => a.id),
        expectedCount: athleteIds.length,
        foundCount: matchingAthletes.length,
        householdId,
        familyId,
        athleteDetails: allRequestedAthletes?.map((a: any) => ({
          id: a.id,
          household_id: a.household_id,
          family_id: a.family_id,
          matchesHousehold: a.household_id === householdId,
          matchesFamily: a.family_id === familyId,
        })),
      })
      
      // Include debug info in development
      const debugInfo = process.env.NODE_ENV === 'development' ? {
        userHouseholdId: householdId,
        userFamilyId: familyId,
        userClubId: clubId,
        athleteDetails: allRequestedAthletes?.map((a: any) => ({
          athlete_id: a.id,
          athlete_household_id: a.household_id,
          athlete_family_id: a.family_id,
          athlete_club_id: a.club_id,
          matchesHousehold: householdId ? a.household_id === householdId : false,
          matchesFamily: familyId ? a.family_id === familyId : false,
          matchesClub: a.club_id === clubId,
        })),
      } : undefined

      return NextResponse.json(
        { 
          error: 'You can only register your own athletes. Please ensure all athletes belong to your household.',
          details: {
            requestedAthletes: athleteIds.length,
            foundAthletes: matchingAthletes.length,
            missingAthleteIds,
            ...(debugInfo ? { debug: debugInfo } : {}),
          }
        },
        { status: 403 }
      )
    }

    // 5. Create registrations (using admin client to bypass RLS)
    const { data: createdRegistrations, error: createError } = await adminSupabase
      .from('registrations')
      .insert(registrations)
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
      registrationIds: createdRegistrations.map((r: any) => r.id),
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


