import { useMutation, useQueryClient } from '@tanstack/react-query'
import { seasonsService } from '../services/seasons-service'

/**
 * React Query hooks for season mutations
 */
export function useCreateSeason() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      start_date: string
      end_date: string
      is_current: boolean
      status: 'draft' | 'active' | 'archived'
      club_id: string
    }) => {
      const result = await seasonsService.createSeason(data)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      // Invalidate seasons query
      queryClient.invalidateQueries({ queryKey: ['seasons'] })
    },
  })
}

export function useUpdateSeason() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      seasonId,
      updates,
    }: {
      seasonId: string
      updates: Partial<{
        name: string
        start_date: string
        end_date: string
        is_current: boolean
        status: 'draft' | 'active' | 'archived'
      }>
    }) => {
      const result = await seasonsService.updateSeason(seasonId, updates)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] })
    },
  })
}

export function useDeleteSeason() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (seasonId: string) => {
      const result = await seasonsService.deleteSeason(seasonId)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] })
    },
  })
}
