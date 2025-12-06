'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabaseClient'
import { useClub } from './club-context'
import { Profile } from './types'

export type Household = {
  id: string
  club_id: string
  primary_email?: string | null
  phone?: string | null
  address?: string | null
}

export type Athlete = {
  id: string
  household_id: string
  first_name: string
  last_name: string
  date_of_birth?: string | null
}

/**
 * Hook for parent pages that:
 * 1. Checks authentication
 * 2. Verifies parent role
 * 3. Gets club_id and household_id
 * 4. Loads household and athletes
 */
export function useParentClub() {
  const router = useRouter()
  const { club } = useClub()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clubId, setClubId] = useState<string | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])

  useEffect(() => {
    async function checkAuthAndGetHousehold() {
      try {
        setLoading(true)
        setError(null)

        // 1. Check authentication
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.replace('/login')
          return
        }

        // 2. Get profile and verify parent role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError('Failed to load profile')
          setLoading(false)
          return
        }

        if (!profileData) {
          setError('Profile not found')
          setLoading(false)
          return
        }

        // Allow parent role (or admin/coach for testing)
        if (profileData.role !== 'parent' && profileData.role !== 'admin' && profileData.role !== 'coach') {
          router.replace('/dashboard')
          return
        }

        setProfile(profileData as Profile)

        // 3. Get club_id from context or profile
        const resolvedClubId = club?.id || profileData.club_id

        if (!resolvedClubId) {
          setError('No club associated with your account. Please contact an administrator.')
          setLoading(false)
          return
        }

        setClubId(resolvedClubId)

        // 4. Get household via household_guardians join table
        const { data: householdGuardian, error: hgError } = await supabase
          .from('household_guardians')
          .select('household_id, households(*)')
          .eq('user_id', user.id)
          .single()

        if (hgError || !householdGuardian) {
          // Try legacy families table as fallback
          const { data: familyData } = await supabase
            .from('families')
            .select('*')
            .eq('profile_id', user.id)
            .single()

          if (familyData) {
            // Map family to household structure
            setHousehold({
              id: familyData.id,
              club_id: familyData.club_id || resolvedClubId,
              primary_email: familyData.email || profileData.email,
              phone: familyData.phone || null,
              address: familyData.address || null,
            })

            // Get athletes from family
            const { data: athletesData } = await supabase
              .from('athletes')
              .select('*')
              .eq('family_id', familyData.id)

            setAthletes((athletesData || []) as Athlete[])
            setLoading(false)
            return
          }

          setError('No household found. Please contact support.')
          setLoading(false)
          return
        }

        const householdData = householdGuardian.households as any
        setHousehold({
          id: householdData.id,
          club_id: householdData.club_id || resolvedClubId,
          primary_email: householdData.primary_email || profileData.email,
          phone: householdData.phone || null,
          address: householdData.address || null,
        })

        // 5. Get athletes for this household
        const { data: athletesData, error: athletesError } = await supabase
          .from('athletes')
          .select('*')
          .eq('household_id', householdData.id)

        if (athletesError) {
          console.error('Error loading athletes:', athletesError)
        } else {
          setAthletes((athletesData || []) as Athlete[])
        }

        setLoading(false)
      } catch (err) {
        console.error('useParentClub error:', err)
        setError('An error occurred')
        setLoading(false)
      }
    }

    checkAuthAndGetHousehold()
  }, [router, club])

  return {
    profile,
    clubId,
    household,
    athletes,
    loading,
    error,
  }
}
