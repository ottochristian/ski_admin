import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders-service'

/**
 * React Query hook for fetching orders by household
 * PHASE 2: RLS handles club filtering automatically
 */
export function useOrdersByHousehold(
  householdId: string | null,
  seasonId?: string
) {
  return useQuery({
    queryKey: ['orders', householdId, seasonId],
    queryFn: async () => {
      if (!householdId) throw new Error('Household ID is required')
      const result = await ordersService.getOrdersByHousehold(
        householdId,
        seasonId
      )
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: !!householdId,
  })
}
