import { useQuery } from '@tanstack/react-query'
import { athletesService } from '../services/athletes-service'

/**
 * React Query hook for fetching athletes
 * PHASE 2: RLS handles club filtering automatically - no clubId needed!
 */
export function useAthletes() {
  return useQuery({
    queryKey: ['athletes'],
    queryFn: async () => {
      // RLS automatically filters by club - no manual filtering needed!
      const result = await athletesService.getAthletes()
      if (result.error) throw result.error
      return result.data || []
    },
  })
}

/**
 * React Query hook for fetching athletes by household
 * PHASE 2: RLS handles club filtering automatically
 * Handles both household_id (new) and family_id (legacy) automatically
 */
export function useAthletesByHousehold(householdId: string | null) {
  return useQuery({
    queryKey: ['athletes', 'household', householdId],
    queryFn: async () => {
      if (!householdId) throw new Error('Household ID is required')
      const result = await athletesService.getAthletesByHousehold(householdId)
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: !!householdId,
  })
}

/**
 * @deprecated Use useAthletesByHousehold() instead - it handles both household_id and family_id
 * This hook will be removed in a future version
 */
export function useAthletesByFamily(familyId: string | null) {
  // Delegate to useAthletesByHousehold which handles both cases
  return useAthletesByHousehold(familyId)
}

/**
 * React Query hook for counting athletes
 */
export function useAthletesCount() {
  return useQuery({
    queryKey: ['athletes', 'count'],
    queryFn: async () => {
      const result = await athletesService.countAthletes()
      if (result.error) throw result.error
      return result.data || 0
    },
  })
}


