import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Fetch all profiles with club name
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, email, first_name, last_name, role, club_id, created_at, email_verified_at, clubs(name)')
      .order('created_at', { ascending: false })

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // Fetch all household_guardians to know who has a household
    const { data: guardians } = await adminClient
      .from('household_guardians')
      .select('user_id, household_id')

    const guardianSet = new Set<string>((guardians || []).map((g: any) => g.user_id))

    // Fetch auth users for last_sign_in_at and email_confirmed_at
    const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const authMap = new Map<string, { last_sign_in_at: string | null; email_confirmed_at: string | null }>()
    for (const u of authData?.users ?? []) {
      authMap.set(u.id, {
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: (u as any).email_confirmed_at ?? null,
      })
    }

    const result = (profiles || []).map((p: any) => {
      const auth = authMap.get(p.id)
      const has_household = guardianSet.has(p.id)
      const email_confirmed_at = auth?.email_confirmed_at ?? null
      const last_sign_in_at = auth?.last_sign_in_at ?? null

      let onboarding_step: string
      if (p.role === 'system_admin') {
        onboarding_step = 'active'
      } else if (p.role === 'admin' || p.role === 'coach') {
        onboarding_step = p.first_name ? 'active' : 'setup_incomplete'
      } else {
        // parent
        if (!p.first_name) {
          onboarding_step = 'account_created'
        } else if (!email_confirmed_at) {
          onboarding_step = 'awaiting_otp'
        } else if (!has_household) {
          onboarding_step = 'otp_verified'
        } else {
          onboarding_step = 'active'
        }
      }

      return {
        id: p.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        role: p.role,
        club_id: p.club_id,
        club_name: p.clubs?.name ?? null,
        created_at: p.created_at,
        last_sign_in_at,
        onboarding_step,
        has_household,
      }
    })

    return NextResponse.json({ users: result })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
