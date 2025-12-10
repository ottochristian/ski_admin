'use client'

/**
 * Refactored useParentClub - Phase 2
 * Now uses base hooks instead of duplicating authentication and data fetching logic
 */
import { useRequireParent } from './auth-context'
import { useClub } from './club-context'
import { useParentHousehold } from './hooks/use-parent-household'
import { useAthletesByHousehold, useAthletesByFamily } from './hooks/use-athletes'

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
  household_id?: string
  family_id?: string
  first_name: string
  last_name: string
  date_of_birth?: string | null
}

/**
 * Hook for parent pages that:
 * 1. Uses useRequireParent() for authentication (no duplicate auth logic!)
 * 2. Uses useParentHousehold() to get household data
 * 3. Uses useAthletesByHousehold() or useAthletesByFamily() for athletes
 * 4. Composes all together with useClub() for club context
 * 
 * PHASE 2: Simplified - no duplicate logic!
 */
export function useParentClub() {
  // Auth - handled by base hook
  const { profile, loading: authLoading } = useRequireParent()
  
  // Club context
  const { club, loading: clubLoading } = useClub()
  
  // Household data - React Query handles caching
  const {
    data: householdData,
    isLoading: householdLoading,
    error: householdError,
  } = useParentHousehold()

  // Determine if using household_id or family_id (legacy)
  // Legacy families have 'address' field but no 'address_line1'
  // New households have 'address_line1' or neither field
  const householdId = householdData?.id || null
  const hasAddressLine1 = householdData && 'address_line1' in householdData
  const hasLegacyAddress = householdData && 'address' in householdData && householdData.address
  const isLegacyFamily = householdData ? hasLegacyAddress && !hasAddressLine1 : false
  const familyId = isLegacyFamily ? householdData?.id || null : null

  // Fetch athletes - React Query handles caching
  // Only fetch if we have the appropriate ID
  const {
    data: householdAthletes = [],
    isLoading: athletesByHouseholdLoading,
  } = useAthletesByHousehold(isLegacyFamily ? null : householdId)

  const {
    data: familyAthletes = [],
    isLoading: athletesByFamilyLoading,
  } = useAthletesByFamily(isLegacyFamily ? familyId : null)

  // Use appropriate athletes list based on whether we're using household or family
  const athletes = isLegacyFamily ? familyAthletes : householdAthletes

  // Resolve club ID
  const clubId = club?.id || profile?.club_id || householdData?.club_id || null

  // Map household data to expected format
  const household: Household | null = householdData
    ? {
        id: householdData.id,
        club_id: householdData.club_id || clubId || '',
        primary_email: householdData.primary_email || null,
        phone: householdData.phone || null,
        address: householdData.address || null,
        address_line1: householdData.address_line1 || null,
        address_line2: householdData.address_line2 || null,
        city: householdData.city || null,
        state: householdData.state || null,
        zip_code: householdData.zip_code || null,
        emergency_contact_name: householdData.emergency_contact_name || null,
        emergency_contact_phone: householdData.emergency_contact_phone || null,
      }
    : null

  // Map athletes to expected format
  const mappedAthletes: Athlete[] = athletes.map((athlete: any) => ({
    id: athlete.id,
    household_id: athlete.household_id || null,
    family_id: athlete.family_id || null,
    first_name: athlete.first_name,
    last_name: athlete.last_name,
    date_of_birth: athlete.date_of_birth || null,
  }))

  const loading =
    authLoading ||
    clubLoading ||
    householdLoading ||
    athletesByHouseholdLoading ||
    athletesByFamilyLoading

  const error = householdError ? householdError.message : null

  return {
    profile,
    clubId,
    household,
    athletes: mappedAthletes,
    loading,
    error,
  }
}
