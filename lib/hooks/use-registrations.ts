import { useQuery } from '@tanstack/react-query'
import { registrationsService } from '../services/registrations-service'

/**
 * React Query hook for fetching registrations
 * PHASE 2: RLS handles club filtering automatically - no clubId needed!
 * 
 * @param seasonId - Optional season filter
 */
export function useRegistrations(seasonId?: string) {
  return useQuery({
    queryKey: ['registrations', seasonId],
    queryFn: async () => {
      // RLS automatically filters by club - no manual filtering needed!
      const result = await registrationsService.getRegistrations(seasonId)
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: seasonId !== undefined, // Only fetch if seasonId is provided (or explicitly undefined)
  })
}

/**
 * React Query hook for recent registrations
 */
export function useRecentRegistrations(seasonId: string | null, limit = 5) {
  return useQuery({
    queryKey: ['registrations', 'recent', seasonId, limit],
    queryFn: async () => {
      if (!seasonId) throw new Error('Season ID is required')
      const result = await registrationsService.getRecentRegistrations(
        seasonId,
        limit
      )
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: !!seasonId,
  })
}

/**
 * React Query hook for registration count
 */
export function useRegistrationsCount(seasonId?: string) {
  return useQuery({
    queryKey: ['registrations', 'count', seasonId],
    queryFn: async () => {
      const result = await registrationsService.countRegistrations(seasonId)
      if (result.error) throw result.error
      return result.data || 0
    },
  })
}

/**
 * React Query hook for total revenue
 */
export function useTotalRevenue(seasonId?: string) {
  return useQuery({
    queryKey: ['registrations', 'revenue', seasonId],
    queryFn: async () => {
      const result = await registrationsService.getTotalRevenue(seasonId)
      if (result.error) throw result.error
      return result.data || 0
    },
  })
}


