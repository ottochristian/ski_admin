import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

/**
 * API route for admins to create athletes
 * Uses admin client to bypass RLS performance issues
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 1. Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      log.warn('Authentication failed in admin create athlete API', {
        error: userError,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user profile and verify admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, club_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      log.warn('Failed to fetch profile in admin create athlete API', {
        userId: user.id,
        error: profileError,
      })
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    // 3. Verify user is an admin
    if (profile.role !== 'admin' && profile.role !== 'system_admin') {
      log.warn('Non-admin user attempted to use admin athlete creation', {
        userId: user.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: 'You must be an admin to create athletes via this endpoint' },
        { status: 403 }
      )
    }

    if (!profile.club_id) {
      log.warn('Admin has no club_id', {
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Your account is not associated with a club' },
        { status: 400 }
      )
    }

    // 4. Parse request body
    const body = await request.json()
    const { firstName, lastName, dateOfBirth, gender, householdId } = body

    if (!firstName || !lastName || !householdId) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, householdId' },
        { status: 400 }
      )
    }

    // 5. Verify household exists and belongs to the same club (using admin client)
    const adminSupabase = createAdminClient()
    const { data: household, error: householdError } = await adminSupabase
      .from('households')
      .select('id, club_id')
      .eq('id', householdId)
      .single()

    if (householdError || !household) {
      log.warn('Household not found', {
        userId: user.id,
        householdId,
        error: householdError,
      })
      return NextResponse.json(
        { error: 'Household not found' },
        { status: 404 }
      )
    }

    // 6. Verify household is in the same club as admin
    if (household.club_id !== profile.club_id) {
      log.warn('Admin attempted to create athlete for household in different club', {
        userId: user.id,
        adminClubId: profile.club_id,
        householdClubId: household.club_id,
      })
      return NextResponse.json(
        { error: 'You can only create athletes for households in your club' },
        { status: 403 }
      )
    }

    // 7. Create athlete using admin client to bypass RLS
    const athleteData: any = {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      household_id: householdId,
      club_id: profile.club_id,
    }

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

    log.info('Athlete created successfully by admin', {
      userId: user.id,
      athleteId: createdAthlete.id,
      clubId: profile.club_id,
    })

    return NextResponse.json({ athlete: createdAthlete }, { status: 201 })
  } catch (err) {
    log.error('Error in admin create athlete API', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
