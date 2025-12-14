import { BaseService, handleSupabaseError, QueryResult } from './base-service'

/**
 * Service for athlete-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class AthletesService extends BaseService {
  /**
   * Get all athletes for the authenticated user's club
   * RLS automatically filters by club - no manual filtering needed!
   */
  async getAthletes(): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('athletes')
      .select('*')
      .order('first_name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Get athlete by ID
   * RLS ensures user can only access athletes in their club
   */
  async getAthleteById(athleteId: string): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('athletes')
      .select('*')
      .eq('id', athleteId)
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Get athletes by household ID
   * Handles both household_id (new) and family_id (legacy) automatically
   * RLS ensures user can only access athletes in their household/family
   */
  async getAthletesByHousehold(householdId: string): Promise<QueryResult<any[]>> {
    // Try household_id first (new structure)
    let result = await this.supabase
      .from('athletes')
      .select('*')
      .eq('household_id', householdId)
      .order('first_name', { ascending: true })

    // If no results, try family_id (legacy structure)
    // This handles the case where householdId might actually be a family_id
    if (!result.error && (!result.data || result.data.length === 0)) {
      result = await this.supabase
        .from('athletes')
        .select('*')
        .eq('family_id', householdId)
        .order('first_name', { ascending: true })
    }

    return handleSupabaseError(result)
  }

  /**
   * @deprecated Use getAthletesByHousehold() instead - it handles both household_id and family_id
   * This method will be removed in a future version
   */
  async getAthletesByFamily(familyId: string): Promise<QueryResult<any[]>> {
    // Delegate to getAthletesByHousehold which handles both cases
    return this.getAthletesByHousehold(familyId)
  }

  /**
   * Count athletes
   * RLS automatically filters by club
   */
  async countAthletes(): Promise<QueryResult<number>> {
    const result = await this.supabase
      .from('athletes')
      .select('*', { count: 'exact', head: true })

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message || 'Failed to count athletes'),
      }
    }

    return {
      data: result.count || 0,
      error: null,
    }
  }
}

export const athletesService = new AthletesService()

