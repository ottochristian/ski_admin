import { BaseService, handleSupabaseError, QueryResult } from './base-service'

/**
 * Service for coach assignment-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class CoachAssignmentsService extends BaseService {
  /**
   * Get assignments for a coach in a season
   * RLS automatically filters by club
   */
  async getAssignmentsByCoach(
    coachId: string,
    seasonId: string
  ): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('coach_assignments')
      .select('id, program_id, sub_program_id, group_id, role')
      .eq('coach_id', coachId)
      .eq('season_id', seasonId)

    return handleSupabaseError(result)
  }

  /**
   * Save assignments for a coach (delete old, insert new)
   * RLS ensures user can only manage assignments in their club
   */
  async saveAssignments(
    coachId: string,
    seasonId: string,
    clubId: string,
    assignments: Array<{
      program_id?: string
      sub_program_id?: string
      group_id?: string
      role: string
    }>
  ): Promise<QueryResult<void>> {
    // Delete existing assignments
    const { error: deleteError } = await this.supabase
      .from('coach_assignments')
      .delete()
      .eq('coach_id', coachId)
      .eq('season_id', seasonId)

    if (deleteError) {
      return {
        data: null,
        error: new Error(deleteError.message || 'Failed to delete old assignments'),
      }
    }

    // Create new assignments
    if (assignments.length > 0) {
      const assignmentsToInsert = assignments.map((assignment) => ({
        coach_id: coachId,
        club_id: clubId,
        season_id: seasonId,
        ...assignment,
      }))

      const { error: insertError } = await this.supabase
        .from('coach_assignments')
        .insert(assignmentsToInsert)

      if (insertError) {
        return {
          data: null,
          error: new Error(insertError.message || 'Failed to create assignments'),
        }
      }
    }

    return { data: undefined, error: null }
  }
}

export const coachAssignmentsService = new CoachAssignmentsService()
