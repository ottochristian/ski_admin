import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { Program } from '../types'

/**
 * Service for program-related database operations
 * 
 * PHASE 2: RLS-FIRST APPROACH
 * - Removed manual club_id filtering - RLS handles it automatically
 * - Queries rely on RLS policies to scope data by club
 * - Simpler, more secure, less error-prone
 */
export class ProgramsService extends BaseService {
  /**
   * Get all programs for the authenticated user's club
   * RLS automatically filters by club - no manual filtering needed!
   * 
   * @param seasonId - Optional season filter
   * @param includeSubPrograms - Whether to include nested sub_programs
   */
  async getPrograms(
    seasonId?: string,
    includeSubPrograms = false
  ): Promise<QueryResult<any[]>> {
    // Note: Alias method name for backward compatibility
    return this.getProgramsByClub(seasonId, includeSubPrograms)
  }

  /**
   * @deprecated Use getPrograms() instead
   */
  async getProgramsByClub(
    seasonId?: string,
    includeSubPrograms = false
  ): Promise<QueryResult<any[]>> {
    // Build select query with optional nested sub_programs
    let selectQuery: any
    if (includeSubPrograms) {
      selectQuery = this.supabase
        .from('programs')
        .select(`
          id,
          name,
          description,
          status,
          club_id,
          season_id,
          sub_programs (
            id,
            name,
            description,
            status,
            program_id
          )
        `)
    } else {
      selectQuery = this.supabase.from('programs').select('*')
    }

    // Only filter by season if provided - RLS handles club filtering automatically
    let query = selectQuery
    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query.order('name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Count active programs
   * RLS automatically filters by club
   */
  async countActivePrograms(seasonId?: string): Promise<QueryResult<number>> {
    let query = this.supabase
      .from('programs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')

    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message || 'Failed to count programs'),
      }
    }

    return {
      data: result.count || 0,
      error: null,
    }
  }

  /**
   * Get program by ID
   * RLS ensures user can only access programs in their club
   */
  async getProgramById(programId: string): Promise<QueryResult<Program>> {
    const result = await this.supabase
      .from('programs')
      .select('*')
      .eq('id', programId)
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Create a new program
   * Still need club_id for INSERT - RLS will verify user can insert to that club
   */
  async createProgram(data: {
    name: string
    club_id: string  // Still required for INSERT
    season_id: string
    status: string
    description?: string
  }): Promise<QueryResult<Program>> {
    const result = await this.supabase
      .from('programs')
      .insert(data)
      .select()
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Update program
   * RLS ensures user can only update programs in their club
   */
  async updateProgram(
    programId: string,
    updates: Partial<Program>
  ): Promise<QueryResult<Program>> {
    const result = await this.supabase
      .from('programs')
      .update(updates)
      .eq('id', programId)
      .select()
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Delete program
   * RLS ensures user can only delete programs in their club
   */
  async deleteProgram(programId: string): Promise<QueryResult<void>> {
    const result = await this.supabase
      .from('programs')
      .delete()
      .eq('id', programId)

    if (result.error) {
      return { data: null, error: new Error(result.error.message) }
    }

    return { data: undefined, error: null }
  }
}

export const programsService = new ProgramsService()


