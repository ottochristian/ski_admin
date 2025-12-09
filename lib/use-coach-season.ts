'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from './supabaseClient'
import { useClub } from './club-context'

export type Season = {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  status: 'draft' | 'active' | 'archived'
  club_id: string
}

/**
 * Hook for coach pages that need season context
 * Gets the current season for the club, or allows selecting a different season
 * Reads selected season from URL params or localStorage
 */
export function useCoachSeason() {
  const { club, loading: clubLoading } = useClub()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])

  useEffect(() => {
    async function loadSeasons() {
      if (clubLoading || !club?.id) {
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load all seasons for this club
        const { data: seasonsData, error: seasonsError } = await supabase
          .from('seasons')
          .select('*')
          .eq('club_id', club.id)
          .order('start_date', { ascending: false })

        if (seasonsError) {
          setError(seasonsError.message)
          setLoading(false)
          return
        }

        const seasonsList = (seasonsData || []) as Season[]
        setSeasons(seasonsList)

        // Find current season
        const current = seasonsList.find((s) => s.is_current === true) || null
        setCurrentSeason(current)

        // Get selected season from URL params or localStorage
        const seasonParam = searchParams.get('season')
        const storedSeasonId =
          typeof window !== 'undefined'
            ? localStorage.getItem('selectedSeasonId')
            : null
        const selectedSeasonId = seasonParam || storedSeasonId

        // Set selected season: use URL param, stored ID, current season, or first season
        if (selectedSeasonId) {
          const selected =
            seasonsList.find((s) => s.id === selectedSeasonId) || null
          setSelectedSeason(selected || current || seasonsList[0] || null)
        } else {
          setSelectedSeason(current || seasonsList[0] || null)
        }
      } catch (err) {
        console.error('useCoachSeason error:', err)
        setError('Failed to load seasons')
      } finally {
        setLoading(false)
      }
    }

    loadSeasons()
  }, [club?.id, clubLoading, searchParams])

  return {
    currentSeason,
    selectedSeason,
    seasons,
    loading: loading || clubLoading,
    error,
    setSelectedSeason,
  }
}
