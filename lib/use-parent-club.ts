'use client'

/**
 * Refactored useParentClub - Phase 2
 * Now uses base hooks instead of duplicating authentication and data fetching logic
 * 
 * PHASE 2: Simplified - uses useRequireParent(), useParentHousehold(), useAthletesByHousehold()
 * Removed ~200 lines of duplicate auth/household loading logic!
 */
export { useParentClub } from './use-parent-club-refactored'
export type { Household, Athlete } from './use-parent-club-refactored'
