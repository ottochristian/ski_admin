'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCoachSeason } from '@/lib/use-coach-season'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'

export function CoachSeasonSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { seasons, selectedSeason, currentSeason, loading } = useCoachSeason()
  const [localSeasonId, setLocalSeasonId] = useState<string | null>(null)

  // Get season from URL query param, localStorage, or use current season
  useEffect(() => {
    const seasonParam = searchParams.get('season')
    const storedSeasonId =
      typeof window !== 'undefined'
        ? localStorage.getItem('selectedSeasonId')
        : null

    if (seasonParam) {
      setLocalSeasonId(seasonParam)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedSeasonId', seasonParam)
      }
    } else if (storedSeasonId) {
      setLocalSeasonId(storedSeasonId)
    } else if (currentSeason) {
      setLocalSeasonId(currentSeason.id)
    }
  }, [searchParams, currentSeason])

  const handleSeasonChange = (seasonId: string) => {
    setLocalSeasonId(seasonId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedSeasonId', seasonId)
    }
    // Update URL with season query param
    const params = new URLSearchParams(searchParams.toString())
    params.set('season', seasonId)
    // Use replace to avoid adding to history, and refresh to trigger data reload
    router.replace(`${pathname}?${params.toString()}`)
    router.refresh()
  }

  if (loading || !seasons.length) {
    return null
  }

  const displaySeason =
    seasons.find((s) => s.id === localSeasonId) || currentSeason || seasons[0]

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-slate-500" />
      <Select value={displaySeason?.id || ''} onValueChange={handleSeasonChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select season">
            {displaySeason?.name || 'Select season'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {seasons
            .filter((s) => s.status !== 'archived')
            .map((season) => (
              <SelectItem key={season.id} value={season.id}>
                <div className="flex items-center gap-2">
                  <span>{season.name}</span>
                  {season.is_current && (
                    <span className="text-xs text-muted-foreground">
                      (Current)
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  )
}


