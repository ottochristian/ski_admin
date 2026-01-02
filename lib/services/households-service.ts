import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { getServiceClient } from './service-client'

/**
 * Service for household-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class HouseholdsService extends BaseService {
  constructor(supabase = getServiceClient()) {
    super(supabase)
  }

  /**
   * Get all households for the authenticated user's club
   * RLS automatically filters by club - no manual filtering needed!
   */
  async getHouseholds(): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('households')
      .select('id, primary_email')
      .order('primary_email')

    return handleSupabaseError(result)
  }

  /**
   * Get household by ID
   * RLS ensures user can only access households in their club
   */
  async getHouseholdById(householdId: string): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single()

    return handleSupabaseError(result)
  }
}

export const householdsService = new HouseholdsService(getServiceClient())


