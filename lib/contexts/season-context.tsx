'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth-context'

/**
 * Season Context - Unified season management across all portals
 * 
 * Portal-aware behavior:
 * - Admin/Coach: Season is controlled via URL query parameter (?season=xxx)
 * - Parent: Always uses current season (no URL state)
 * 
 * This provides a single source of truth for season state across the application.
 */

export type PortalType = 'admin' | 'coach' | 'parent' | 'public'

interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  status: 'draft' | 'active' | 'archived'
  club_id: string
}

interface SeasonContextValue {
  // Current portal type (auto-detected from URL)
  portalType: PortalType
  
  // All available seasons for this club
  seasons: Season[]
  
  // Currently selected season (from URL for admin/coach, current season for parent)
  selectedSeason: Season | null
  
  // Current season (marked as is_current in DB)
  currentSeason: Season | null
  
  // Loading state
  loading: boolean
  
  // Error state
  error: Error | null
  
  // Change season (updates URL for admin/coach, no-op for parent)
  setSelectedSeason: (seasonId: string) => void
}

const SeasonContext = createContext<SeasonContextValue | undefined>(undefined)

interface SeasonProviderProps {
  children: React.ReactNode
}

export function SeasonProvider({ children }: SeasonProviderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { profile } = useAuth()
  
  // Detect portal type from URL structure
  const portalType = useMemo((): PortalType => {
    if (pathname.includes('/admin')) return 'admin'
    if (pathname.includes('/coach')) return 'coach'
    if (pathname.includes('/parent')) return 'parent'
    return 'public'
  }, [pathname])
  
  // Fetch all seasons for this club (RLS handles club filtering)
  const {
    data: seasons = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['seasons', profile?.club_id],
    queryFn: async () => {
      if (!profile?.club_id) {
        throw new Error('No club associated with your account')
      }

      // RLS automatically filters by club
      const { data, error } = await supabase.from('seasons')
        .select('*')
        .order('start_date', { ascending: false })

      if (error) throw error
      return (data || []) as Season[]
    },
    enabled: !!profile?.club_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  
  // Find current season (marked as is_current)
  const currentSeason = useMemo(
    () => seasons.find((s) => s.is_current) || seasons[0] || null,
    [seasons]
  )
  
  // State for selected season ID (used for admin/coach portals)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)
  
  // Initialize selected season from URL (admin/coach) or current season (parent)
  useEffect(() => {
    if (portalType === 'admin' || portalType === 'coach') {
      // Read from URL query param
      const seasonParam = searchParams.get('season')
      if (seasonParam) {
        setSelectedSeasonId(seasonParam)
      } else if (currentSeason && !selectedSeasonId) {
        // Default to current season if no URL param
        setSelectedSeasonId(currentSeason.id)
      }
    } else if (portalType === 'parent') {
      // Parents always use current season
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id)
      }
    }
  }, [portalType, searchParams, currentSeason, selectedSeasonId])
  
  // Find selected season object
  const selectedSeason = useMemo(() => {
    if (!selectedSeasonId) return currentSeason
    return seasons.find((s) => s.id === selectedSeasonId) || currentSeason
  }, [selectedSeasonId, seasons, currentSeason])
  
  // Change season handler (portal-aware)
  const setSelectedSeason = (seasonId: string) => {
    if (portalType === 'admin' || portalType === 'coach') {
      // Update URL query parameter
      const params = new URLSearchParams(searchParams.toString())
      params.set('season', seasonId)
      router.replace(`${pathname}?${params.toString()}`)
      setSelectedSeasonId(seasonId)
    } else if (portalType === 'parent') {
      // Parents can't change seasons - this is a no-op
      console.warn('Parents cannot change seasons')
    }
  }
  
  const value: SeasonContextValue = useMemo(
    () => ({
      portalType,
      seasons,
      selectedSeason,
      currentSeason,
      loading: isLoading,
      error: queryError as Error | null,
      setSelectedSeason,
    }),
    [
      portalType,
      seasons,
      selectedSeason,
      currentSeason,
      isLoading,
      queryError,
      setSelectedSeason,
    ]
  )
  
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
}

/**
 * Hook to access season context
 * 
 * @throws {Error} If used outside of SeasonProvider
 */
export function useSeason(): SeasonContextValue {
  const context = useContext(SeasonContext)
  if (context === undefined) {
    throw new Error('useSeason must be used within a SeasonProvider')
  }
  return context
}

/**
 * Hook to get only the selected season (most common use case)
 * 
 * @returns The currently selected season or null
 */
export function useSelectedSeason(): Season | null {
  const { selectedSeason } = useSeason()
  return selectedSeason
}

/**
 * Hook to get only the current season (marked as is_current)
 * 
 * @returns The current season or null
 */
export function useCurrentSeason(): Season | null {
  const { currentSeason } = useSeason()
  return currentSeason
}

/**
 * Hook to check if a portal can change seasons
 * 
 * @returns True if the current portal allows season changes
 */
export function useCanChangeSeason(): boolean {
  const { portalType } = useSeason()
  return portalType === 'admin' || portalType === 'coach'
}
