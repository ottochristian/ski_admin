'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth-context'

export interface Season {
  id: string
  club_id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  status: 'draft' | 'active' | 'archived'
}

/**
 * Base hook for season management
 * Works for all roles (admin, coach, parent)
 * RLS automatically filters seasons by club - no manual filtering needed!
 * 
 * Features:
 * - Fetches all seasons for user's club
 * - Finds current season
 * - Manages selected season via URL params or localStorage
 */
export function useSeason() {
  const { profile, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null)

  // Get all seasons for the user's club - RLS handles club filtering automatically!
  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['seasons', profile?.club_id],
    queryFn: async () => {
      if (!profile?.club_id) {
        throw new Error('No club associated with your account')
      }

      // RLS automatically filters by club - no manual filtering needed!
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('start_date', { ascending: false })

      if (error) throw error
      return (data || []) as Season[]
    },
    enabled: !!profile?.club_id && !authLoading,
  })

  // Get current season
  const currentSeason = seasons.find((s) => s.is_current) || null

  // Manage selected season (from URL params or localStorage)
  useEffect(() => {
    if (seasons.length === 0) {
      setSelectedSeason(null)
      return
    }

    // Get selected season from URL params or localStorage
    const seasonParam = searchParams.get('season')
    const storedSeasonId =
      typeof window !== 'undefined'
        ? localStorage.getItem('selectedSeasonId')
        : null
    const selectedSeasonId = seasonParam || storedSeasonId

    // Set selected season: use URL param, stored ID, current season, or first season
    if (selectedSeasonId) {
      const selected = seasons.find((s) => s.id === selectedSeasonId) || null
      setSelectedSeason(selected || currentSeason || seasons[0] || null)
    } else {
      setSelectedSeason(currentSeason || seasons[0] || null)
    }
  }, [seasons, currentSeason, searchParams])

  // Save selected season to localStorage when it changes
  const handleSetSelectedSeason = (season: Season | null) => {
    setSelectedSeason(season)
    if (typeof window !== 'undefined') {
      if (season) {
        localStorage.setItem('selectedSeasonId', season.id)
      } else {
        localStorage.removeItem('selectedSeasonId')
      }
    }
  }

  return {
    seasons,
    currentSeason,
    selectedSeason,
    loading: isLoading || authLoading,
    setSelectedSeason: handleSetSelectedSeason,
  }
}

/**
 * Hook to get a specific season by ID
 * RLS ensures user can only access seasons in their club
 */
export function useSeasonById(seasonId: string | null) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['season', seasonId],
    queryFn: async () => {
      if (!seasonId) throw new Error('Season ID is required')

      // RLS ensures user can only access seasons in their club
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', seasonId)
        .single()

      if (error) throw error
      return data as Season
    },
    enabled: !!seasonId && !!profile?.club_id,
  })
}
