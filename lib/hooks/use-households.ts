import { useQuery } from '@tanstack/react-query'
import { householdsService } from '../services/households-service'

/**
 * React Query hook for fetching households
 * PHASE 2: RLS handles club filtering automatically
 */
export function useHouseholds() {
  return useQuery({
    queryKey: ['households'],
    queryFn: async () => {
      const result = await householdsService.getHouseholds()
      if (result.error) throw result.error
      return result.data || []
    },
  })
}
