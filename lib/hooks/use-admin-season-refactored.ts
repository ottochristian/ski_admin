'use client'

/**
 * Refactored useAdminSeason - Phase 2
 * Now uses base useSeason hook instead of duplicating logic
 */
import { useSeason } from './use-season'
import { useRequireAdmin } from '../auth-context'

/**
 * Hook for admin pages that need season context
 * Simply wraps the base useSeason hook with admin role check
 */
export function useAdminSeason() {
  const { profile, loading: authLoading } = useRequireAdmin()
  const seasonHook = useSeason()

  return {
    ...seasonHook,
    // Keep the same API as before for backward compatibility
    loading: seasonHook.loading || authLoading,
  }
}
