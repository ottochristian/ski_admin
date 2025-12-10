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
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
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
          router.replace('/login')
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
        // Fetch in two steps to avoid RLS issues with nested queries
        console.log('[useParentClub] Attempting to load household for user:', user.id)
        
        // Step 1: Get household_guardians record (simpler query, less likely to hit RLS issues)
        const { data: householdGuardian, error: hgError } = await supabase
          .from('household_guardians')
          .select('household_id')
          .eq('user_id', user.id)
          .maybeSingle()

        console.log('[useParentClub] Household guardian query result:', {
          hasData: !!householdGuardian,
          householdId: householdGuardian?.household_id,
          error: hgError ? {
            message: hgError.message,
            code: hgError.code,
            details: hgError.details,
            hint: hgError.hint,
          } : null,
        })

        if (hgError || !householdGuardian || !householdGuardian.household_id) {
          console.log('[useParentClub] Household guardian not found, trying families table...', { 
            hgError,
            errorDetails: hgError ? {
              message: hgError.message,
              code: hgError.code,
              details: hgError.details,
            } : null,
          })
          
          // Try legacy families table as fallback
          const { data: familyData, error: familyError } = await supabase
            .from('families')
            .select('*')
            .eq('profile_id', user.id)
            .maybeSingle()

          if (familyData) {
            console.log('[useParentClub] Found family data, mapping to household structure')
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

          // No household or family found - don't set error, let layout handle it
          console.warn('[useParentClub] No household or family found for user:', user.id)
          setHousehold(null)
          setLoading(false)
          return
        }

        // Step 2: Fetch household directly using household_id (separate query avoids nested RLS issues)
        console.log('[useParentClub] Fetching household with ID:', householdGuardian.household_id)
        const { data: householdData, error: householdError } = await supabase
          .from('households')
          .select('*')
          .eq('id', householdGuardian.household_id)
          .maybeSingle()

        console.log('[useParentClub] Household fetch result:', {
          hasData: !!householdData,
          householdId: householdData?.id,
          error: householdError ? {
            message: householdError.message,
            code: householdError.code,
            details: householdError.details,
          } : null,
        })

        if (householdError || !householdData) {
          console.error('[useParentClub] Failed to fetch household:', householdError)
          // Try families table as fallback
          const { data: familyData } = await supabase
            .from('families')
            .select('*')
            .eq('profile_id', user.id)
            .maybeSingle()

          if (familyData) {
            console.log('[useParentClub] Using family data as fallback')
            setHousehold({
              id: familyData.id,
              club_id: familyData.club_id || resolvedClubId,
              primary_email: familyData.email || profileData.email,
              phone: familyData.phone || null,
              address: familyData.address || null,
            })
            const { data: athletesData } = await supabase
              .from('athletes')
              .select('*')
              .eq('family_id', familyData.id)
            setAthletes((athletesData || []) as Athlete[])
            setLoading(false)
            return
          }

          setHousehold(null)
          setLoading(false)
          return
        }

        // Successfully loaded household
        setHousehold({
          id: householdData.id,
          club_id: householdData.club_id || resolvedClubId,
          primary_email: householdData.primary_email || profileData.email,
          phone: householdData.phone || null,
          address: null, // Legacy field - households table uses address_line1/address_line2 instead
          address_line1: householdData.address_line1 || null,
          address_line2: householdData.address_line2 || null,
          city: householdData.city || null,
          state: householdData.state || null,
          zip_code: householdData.zip_code || null,
          emergency_contact_name: householdData.emergency_contact_name || null,
          emergency_contact_phone: householdData.emergency_contact_phone || null,
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
