import { BaseService, handleSupabaseError, QueryResult } from './base-service'

/**
 * Service for sub-program-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class SubProgramsService extends BaseService {
  /**
   * Get all sub-programs for a program
   * RLS ensures user can only access sub-programs in their club
   */
  async getSubProgramsByProgram(
    programId: string,
    seasonId?: string
  ): Promise<QueryResult<any[]>> {
    let query = this.supabase
      .from('sub_programs')
      .select('id, name, description, status, program_id, season_id')
      .eq('program_id', programId)

    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query.order('name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Get sub-program by ID
   * RLS ensures user can only access sub-programs in their club
   */
  async getSubProgramById(subProgramId: string): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('sub_programs')
      .select('*')
      .eq('id', subProgramId)
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Create a new sub-program
   * Still need club_id for INSERT - RLS will verify user can insert to that club
   */
  async createSubProgram(data: {
    name: string
    program_id: string
    club_id: string
    season_id?: string
    description?: string | null
    status?: string
    registration_fee?: number | null
    max_capacity?: number | null
  }): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('sub_programs')
      .insert(data)
      .select()
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Update sub-program
   * RLS ensures user can only update sub-programs in their club
   */
  async updateSubProgram(
    subProgramId: string,
    updates: Partial<any>
  ): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('sub_programs')
      .update(updates)
      .eq('id', subProgramId)
      .select()
      .single()

    return handleSupabaseError(result)
  }
}

export const subProgramsService = new SubProgramsService()

