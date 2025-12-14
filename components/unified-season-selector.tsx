'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import { useSeason, useCanChangeSeason } from '@/lib/contexts/season-context'

/**
 * Unified Season Selector Component
 * 
 * Portal-aware season selector that:
 * - Shows for admin/coach portals (allows selection)
 * - Shows for parent portal (display only, no selection)
 * - Automatically syncs with URL state for admin/coach
 * - Always shows current season for parents
 */
export function UnifiedSeasonSelector() {
  const {
    seasons,
    selectedSeason,
    currentSeason,
    loading,
    setSelectedSeason,
  } = useSeason()
  
  const canChangeSeason = useCanChangeSeason()
  
  // Don't render if loading or no seasons
  if (loading || seasons.length === 0) {
    return null
  }
  
  // Filter out archived seasons
  const activeSeasons = seasons.filter((s) => s.status !== 'archived')
  
  // Display season (selected or current)
  const displaySeason = selectedSeason || currentSeason
  
  if (!displaySeason) {
    return null
  }
  
  // If can't change season (parent portal), show read-only display
  if (!canChangeSeason) {
    return (
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-slate-500" />
        <div className="text-sm font-medium text-slate-700">
          {displaySeason.name}
          {displaySeason.is_current && (
            <span className="ml-2 text-xs text-slate-500">(Current)</span>
          )}
        </div>
      </div>
    )
  }
  
  // Admin/Coach: Show interactive selector
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-slate-500" />
      <Select
        value={displaySeason.id}
        onValueChange={setSelectedSeason}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue>
            {displaySeason.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {activeSeasons.map((season) => (
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
