import { useQuery } from '@tanstack/react-query'
import { subProgramsService } from '../services/sub-programs-service'

/**
 * React Query hook for fetching sub-programs by program
 * PHASE 2: RLS handles club filtering automatically
 */
export function useSubProgramsByProgram(
  programId: string | null,
  seasonId?: string
) {
  return useQuery({
    queryKey: ['sub-programs', programId, seasonId],
    queryFn: async () => {
      if (!programId) throw new Error('Program ID is required')
      const result = await subProgramsService.getSubProgramsByProgram(
        programId,
        seasonId
      )
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: !!programId,
  })
}

