'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from './supabaseClient'
import { useAdminClub } from './use-admin-club'

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
 * Hook for admin pages that need season context
 * Gets the current season for the club, or allows selecting a different season
 * Reads selected season from URL params or localStorage
 */
export function useAdminSeason() {
  const { clubId, loading: clubLoading, error: clubError } = useAdminClub()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])

  useEffect(() => {
    async function loadSeasons() {
      if (clubLoading || !clubId) {
        return
      }

      if (clubError) {
        setError(clubError)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load all seasons for this club
        const { data: seasonsData, error: seasonsError } = await supabase
          .from('seasons')
          .select('*')
          .eq('club_id', clubId)
          .order('start_date', { ascending: false })

        if (seasonsError) {
          setError(seasonsError.message)
          setLoading(false)
          return
        }

        const seasonsList = (seasonsData || []) as Season[]
        setSeasons(seasonsList)

        // Find current season
        const current = seasonsList.find(s => s.is_current === true) || null
        setCurrentSeason(current)

        // Get selected season from URL params or localStorage
        const seasonParam = searchParams.get('season')
        const storedSeasonId = typeof window !== 'undefined' ? localStorage.getItem('selectedSeasonId') : null
        const selectedSeasonId = seasonParam || storedSeasonId

        // Set selected season: use URL param, stored ID, current season, or first season
        if (selectedSeasonId) {
          const selected = seasonsList.find(s => s.id === selectedSeasonId) || null
          setSelectedSeason(selected || current || seasonsList[0] || null)
        } else {
          setSelectedSeason(current || seasonsList[0] || null)
        }
      } catch (err) {
        console.error('useAdminSeason error:', err)
        setError('Failed to load seasons')
      } finally {
        setLoading(false)
      }
    }

    loadSeasons()
  }, [clubId, clubLoading, clubError, searchParams])

  return {
    currentSeason,
    selectedSeason,
    seasons,
    loading: loading || clubLoading,
    error: error || clubError,
    setSelectedSeason,
  }
}
