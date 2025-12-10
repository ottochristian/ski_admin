import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { Program } from '../types'

/**
 * Service for program-related database operations
 */
export class ProgramsService extends BaseService {
  /**
   * Get all programs for a club with optional nested sub_programs
   */
  async getProgramsByClub(
    clubId: string,
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

    let query = selectQuery.eq('club_id', clubId)

    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query.order('name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Get program by ID (with club check via RLS)
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
   */
  async createProgram(data: {
    name: string
    club_id: string
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
