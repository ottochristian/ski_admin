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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'programs-service.ts:GET_PROGRAMS_START',message:'Starting getProgramsByClub query',data:{seasonId,includeSubPrograms},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,D'})}).catch(()=>{});
    // #endregion

    // Build select query with optional nested sub_programs
    let selectQuery: any
    if (includeSubPrograms) {
      // NOTE: Use LEFT join (default) NOT !inner join
      // !inner would filter out programs without sub-programs, which breaks new program creation
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
            program_id,
            registration_fee,
            max_capacity,
            registrations (count)
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

    // Filter out soft-deleted programs
    query = query.is('deleted_at', null)

    const result = await query.order('name', { ascending: true })

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'programs-service.ts:GET_PROGRAMS_RESULT',message:'Query result',data:{success:!result.error,error:result.error?.message,count:result.data?.length,programNames:result.data?.map((p:any)=>p.name),hasDeletedAt:result.data?.map((p:any)=>({name:p.name,deleted_at:p.deleted_at}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,D'})}).catch(()=>{});
    // #endregion

    // Filter out soft-deleted sub-programs in application layer
    // (Can't use database filter with LEFT join without excluding programs without sub-programs)
    if (includeSubPrograms && result.data) {
      result.data = result.data.map((program: any) => ({
        ...program,
        sub_programs: program.sub_programs?.filter((sp: any) => sp.deleted_at === null) || []
      }))
    }

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


