import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { programsService } from '../services/programs-service'
import { Program } from '../types'

/**
 * React Query hook for fetching programs by club
 */
export function usePrograms(
  clubId: string | null,
  seasonId?: string,
  includeSubPrograms = false
) {
  return useQuery({
    queryKey: ['programs', clubId, seasonId, includeSubPrograms],
    queryFn: async () => {
      if (!clubId) throw new Error('Club ID is required')
      const result = await programsService.getProgramsByClub(
        clubId,
        seasonId,
        includeSubPrograms
      )
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: !!clubId, // Only run query if clubId is provided
  })
}

/**
 * React Query hook for fetching a single program
 */
export function useProgram(programId: string | null) {
  return useQuery({
    queryKey: ['program', programId],
    queryFn: async () => {
      if (!programId) throw new Error('Program ID is required')
      const result = await programsService.getProgramById(programId)
      if (result.error) throw result.error
      return result.data
    },
    enabled: !!programId,
  })
}

/**
 * React Query hook for creating a program
 */
export function useCreateProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      club_id: string
      season_id: string
      status: string
      description?: string
    }) => {
      const result = await programsService.createProgram(data)
      if (result.error) throw result.error
      return result.data!
    },
    onSuccess: (_, variables) => {
      // Invalidate programs list for this club and season
      queryClient.invalidateQueries({
        queryKey: ['programs', variables.club_id, variables.season_id],
      })
    },
  })
}

/**
 * React Query hook for updating a program
 */
export function useUpdateProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Program> }) => {
      const result = await programsService.updateProgram(id, updates)
      if (result.error) throw result.error
      return result.data!
    },
    onSuccess: (data) => {
      // Invalidate the specific program and programs list
      queryClient.invalidateQueries({ queryKey: ['program', data.id] })
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}

/**
 * React Query hook for deleting a program
 */
export function useDeleteProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (programId: string) => {
      const result = await programsService.deleteProgram(programId)
      if (result.error) throw result.error
    },
    onSuccess: () => {
      // Invalidate all programs queries
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}
