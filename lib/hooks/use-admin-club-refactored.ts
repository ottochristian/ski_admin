'use client'

/**
 * Refactored useAdminClub - Phase 2
 * Now uses base useAuth hook instead of duplicating authentication logic
 */
import { useRequireAdmin } from '../auth-context'
import { useClub } from '../club-context'

/**
 * Hook for admin pages that need club context
 * Composes base auth hook with club context
 * 
 * PHASE 2: Simplified - no duplicate auth logic!
 */
export function useAdminClub() {
  const { profile, loading: authLoading } = useRequireAdmin()
  const { club, loading: clubLoading } = useClub()

  // Resolve club ID from context or profile
  const clubId = club?.id || profile?.club_id || null

  return {
    profile,
    clubId,
    loading: authLoading || clubLoading,
    error: null, // useRequireAdmin handles errors via redirects
  }
}


