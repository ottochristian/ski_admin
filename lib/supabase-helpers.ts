import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceClient } from './services/service-client'

/**
 * Standard helper to add club_id filter to any Supabase query
 * Use this for ALL admin queries to ensure club filtering
 * 
 * @example
 * const { data } = await clubQuery(
 *   supabase.from('programs').select('*'),
 *   clubId
 * )
 */
export function clubQuery<T = any>(
  query: any,
  clubId: string | null | undefined
) {
  if (!clubId) {
    throw new Error('clubId is required for club-filtered queries')
  }
  return query.eq('club_id', clubId)
}

/**
 * Helper to add club_id and optionally season_id to insert/update operations
 * Use this when creating/updating records
 * 
 * @example
 * await supabase.from('programs').insert(
 *   withClubData({ name: 'Alpine' }, clubId, seasonId)
 * )
 */
export function withClubData<T extends Record<string, any>>(
  data: T,
  clubId: string | null | undefined,
  seasonId?: string | null
): T & { club_id: string; season_id?: string } {
  if (!clubId) {
    throw new Error('clubId is required')
  }

  return {
    ...data,
    club_id: clubId,
    ...(seasonId && { season_id: seasonId }),
  }
}

/**
 * Get current season for a club
 * 
 * @param clubId - The club ID
 * @param supabaseClient - Optional Supabase client (defaults to service client)
 */
export async function getCurrentSeason(
  clubId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient || getServiceClient()
  
  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('club_id', clubId)
    .eq('is_current', true)
    .single()

  if (error) {
    console.error('Error getting current season:', error)
    return null
  }

  return data
}

