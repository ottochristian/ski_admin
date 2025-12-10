import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { supabase } from '../supabaseClient'

/**
 * Service for household_guardians related operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles filtering automatically
 */
export class HouseholdGuardiansService extends BaseService {
  /**
   * Get household ID for the current authenticated user
   * RLS ensures user can only see their own household
   */
  async getHouseholdIdForCurrentUser(): Promise<QueryResult<string | null>> {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        data: null,
        error: new Error('Not authenticated'),
      }
    }

    // Get household_id via household_guardians
    const result = await this.supabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: result.data?.household_id || null,
      error: null,
    }
  }

  /**
   * Get household data for the current authenticated user
   * Handles both households table and legacy families table fallback
   */
  async getHouseholdForCurrentUser(): Promise<QueryResult<any>> {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        data: null,
        error: new Error('Not authenticated'),
      }
    }

    // Step 1: Try household_guardians -> households
    const hgResult = await this.supabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (hgResult.data?.household_id) {
      // Fetch household
      const householdResult = await this.supabase
        .from('households')
        .select('*')
        .eq('id', hgResult.data.household_id)
        .maybeSingle()

      if (householdResult.error) {
        return handleSupabaseError(householdResult)
      }

      if (householdResult.data) {
        return {
          data: householdResult.data,
          error: null,
        }
      }
    }

    // Step 2: Fallback to legacy families table
    const familyResult = await this.supabase
      .from('families')
      .select('*')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (familyResult.error) {
      // If no family found either, return null data (not an error)
      return {
        data: null,
        error: null,
      }
    }

    if (familyResult.data) {
      // Map family to household structure
      return {
        data: {
          id: familyResult.data.id,
          club_id: familyResult.data.club_id,
          primary_email: familyResult.data.email || null,
          phone: familyResult.data.phone || null,
          address: familyResult.data.address || null,
          // Legacy families don't have address_line1/address_line2
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          zip_code: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
        },
        error: null,
      }
    }

    // No household or family found
    return {
      data: null,
      error: null,
    }
  }
}

export const householdGuardiansService = new HouseholdGuardiansService()
