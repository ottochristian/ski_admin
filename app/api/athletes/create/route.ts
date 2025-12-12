import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { log } from '@/lib/logger'

/**
 * API route to create athletes for parent accounts
 * Uses admin client to bypass RLS, but verifies user owns the household
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      log.warn('Authentication failed in create athlete API', {
        status: authResult.status,
      })
      return authResult
    }

    const { user } = authResult
    log.info('User authenticated for athlete creation', { userId: user.id })
    const adminSupabase = createSupabaseAdminClient()

    // 2. Parse request body
    const body = await request.json()
    const { athlete, clubId, householdId } = body

    if (!athlete || !clubId) {
      return NextResponse.json(
        { error: 'Invalid athlete data or missing clubId' },
        { status: 400 }
      )
    }

    // 3. Verify user is linked to the household
    if (!householdId) {
      return NextResponse.json(
        { error: 'householdId is required' },
        { status: 400 }
      )
    }

    const { data: householdGuardian } = await adminSupabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .eq('household_id', householdId)
      .maybeSingle()

    // Check legacy families table as fallback
    const { data: family } = await adminSupabase
      .from('families')
      .select('id')
      .eq('profile_id', user.id)
      .eq('id', householdId)
      .maybeSingle()

    if (!householdGuardian && !family) {
      log.warn('User attempted to create athlete without household or family link', {
        userId: user.id,
        householdId,
      })
      return NextResponse.json(
        { error: 'You are not authorized to create athletes for this household.' },
        { status: 403 }
      )
    }

    // 4. Verify club_id matches user's club (or athlete's club matches)
    const athleteClubId = athlete.club_id || clubId
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('club_id')
      .eq('id', user.id)
      .single()

    if (profile?.club_id && athleteClubId !== profile.club_id) {
      log.warn('User attempted to create athlete in different club', {
        userId: user.id,
        userClubId: profile.club_id,
        athleteClubId,
      })
      return NextResponse.json(
        { error: 'You can only create athletes in your own club.' },
        { status: 403 }
      )
    }

    // 5. Prepare athlete data
    const athleteData: any = {
      ...athlete,
      club_id: athleteClubId,
    }

    // Set household_id or family_id based on which link exists
    if (householdGuardian) {
      athleteData.household_id = householdId
      // Clear family_id if it was set
      delete athleteData.family_id
    } else if (family) {
      athleteData.family_id = householdId
      // Clear household_id if it was set
      delete athleteData.household_id
    }

    // 6. Create athlete (using admin client to bypass RLS)
    const { data: createdAthlete, error: createError } = await adminSupabase
      .from('athletes')
      .insert([athleteData])
      .select()
      .single()

    if (createError || !createdAthlete) {
      log.error('Error creating athlete', createError, {
        userId: user.id,
        athleteData,
      })
      return NextResponse.json(
        { error: createError?.message || 'Failed to create athlete' },
        { status: 500 }
      )
    }

    log.info('Athlete created successfully', {
      userId: user.id,
      athleteId: createdAthlete.id,
    })

    return NextResponse.json({ athlete: createdAthlete }, { status: 201 })
  } catch (err) {
    log.error('Error in create athlete API', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

