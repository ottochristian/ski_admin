import { useQuery } from '@tanstack/react-query'

export interface ProgramAnalytics {
  id: string
  name: string
  currentEnrollment: number  // confirmed + pending only (excludes waitlisted)
  waitlistedCount: number
  maxCapacity: number | null
  enrollmentRate: number | null
  revenue: number
  paidCount: number
  unpaidCount: number
  pricePerPerson: number
  avgRevenuePerAthlete: number
}

export interface ProgramsSummary {
  totalPrograms: number
  totalWaitlisted: number
  avgEnrollmentRate: number | null
  mostPopularProgram: { id: string; name: string; enrollment: number } | null
  totalRevenue: number
  avgRevenuePerProgram: number
}

export interface ProgramsAnalyticsResponse {
  summary: ProgramsSummary
  programs: ProgramAnalytics[]
}

export function useProgramsAnalytics(
  clubId: string | null,
  seasonId: string | null
) {
  return useQuery<ProgramsAnalyticsResponse>({
    queryKey: ['programs-analytics', clubId, seasonId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (clubId) params.append('clubId', clubId)
      if (seasonId) params.append('seasonId', seasonId)

      const response = await fetch(`/api/admin/programs/analytics?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch programs analytics')
      }
      return response.json()
    },
    enabled: !!clubId && !!seasonId,
  })
}
