import { useQuery } from '@tanstack/react-query'
import { householdGuardiansService } from '../services/household-guardians-service'

/**
 * React Query hook for fetching the current parent user's household
 * PHASE 2: RLS-FIRST APPROACH - RLS handles filtering automatically
 * Handles both households table and legacy families table fallback
 */
export function useParentHousehold() {
  return useQuery({
    queryKey: ['parent-household'],
    queryFn: async () => {
      const result = await householdGuardiansService.getHouseholdForCurrentUser()
      if (result.error) throw result.error
      return result.data || null
    },
  })
}


