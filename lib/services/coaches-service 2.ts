import { BaseService, handleSupabaseError, QueryResult } from './base-service'

/**
 * Service for coach-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class CoachesService extends BaseService {
  /**
   * Get all coaches for the authenticated user's club
   * RLS automatically filters by club - no manual filtering needed!
   */
  async getCoaches(): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('coaches')
      .select('*')
      .order('first_name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Get coaches with their assignments
   * RLS automatically filters by club
   */
  async getCoachesWithAssignments(): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('coaches')
      .select(`
        *,
        coach_assignments (
          id,
          program_id,
          sub_program_id,
          group_id,
          role,
          programs (name),
          sub_programs (name),
          groups (name)
        )
      `)
      .order('first_name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Get coach by ID
   * RLS ensures user can only access coaches in their club
   */
  async getCoachById(coachId: string): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('coaches')
      .select('*')
      .eq('id', coachId)
      .single()

    return handleSupabaseError(result)
  }
}

export const coachesService = new CoachesService()

