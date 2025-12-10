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
 * React Query hook for fetching athletes by family (legacy support)
 * PHASE 2: RLS handles club filtering automatically
 */
export function useAthletesByFamily(familyId: string | null) {
  return useQuery({
    queryKey: ['athletes', 'family', familyId],
    queryFn: async () => {
      if (!familyId) throw new Error('Family ID is required')
      const result = await athletesService.getAthletesByFamily(familyId)
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: !!familyId,
  })
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
