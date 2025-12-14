import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { supabase } from '../supabaseClient'

/**
 * Service for season-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class SeasonsService extends BaseService {
  /**
   * Create a new season
   * Still need club_id for INSERT - RLS will verify user can insert to that club
   */
  async createSeason(data: {
    name: string
    start_date: string
    end_date: string
    is_current: boolean
    status: 'draft' | 'active' | 'archived'
    club_id: string
  }): Promise<QueryResult<any>> {
    // If setting as current, unset other current seasons first
    if (data.is_current) {
      await supabase
        .from('seasons')
        .update({ is_current: false })
        .eq('is_current', true)
    }

    const result = await this.supabase
      .from('seasons')
      .insert(data)
      .select()
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Update season
   * RLS ensures user can only update seasons in their club
   */
  async updateSeason(
    seasonId: string,
    updates: Partial<any>
  ): Promise<QueryResult<any>> {
    // If setting as current, unset other current seasons first
    if (updates.is_current === true) {
      await supabase
        .from('seasons')
        .update({ is_current: false })
        .eq('is_current', true)
    }

    const result = await this.supabase
      .from('seasons')
      .update(updates)
      .eq('id', seasonId)
      .select()
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Delete season
   * RLS ensures user can only delete seasons in their club
   */
  async deleteSeason(seasonId: string): Promise<QueryResult<void>> {
    const result = await this.supabase.from('seasons').delete().eq('id', seasonId)

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message || 'Failed to delete season'),
      }
    }

    return { data: undefined, error: null }
  }
}

export const seasonsService = new SeasonsService()


