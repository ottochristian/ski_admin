import { useQuery } from '@tanstack/react-query'
import { coachesService } from '../services/coaches-service'

/**
 * React Query hook for fetching coaches
 * PHASE 2: RLS handles club filtering automatically - no clubId needed!
 */
export function useCoaches(includeAssignments = false) {
  return useQuery({
    queryKey: ['coaches', includeAssignments],
    queryFn: async () => {
      // RLS automatically filters by club - no manual filtering needed!
      const result = includeAssignments
        ? await coachesService.getCoachesWithAssignments()
        : await coachesService.getCoaches()
      if (result.error) throw result.error
      return result.data || []
    },
  })
}

/**
 * React Query hook for fetching a single coach
 */
export function useCoach(coachId: string | null) {
  return useQuery({
    queryKey: ['coach', coachId],
    queryFn: async () => {
      if (!coachId) throw new Error('Coach ID is required')
      const result = await coachesService.getCoachById(coachId)
      if (result.error) throw result.error
      return result.data
    },
    enabled: !!coachId,
  })
}


