import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { getServiceClient } from './service-client'

/**
 * Service for household_guardians related operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles filtering automatically
 */
export class HouseholdGuardiansService extends BaseService {
  constructor(supabase = getServiceClient()) {
    super(supabase)
  }

  /**
   * Get household ID for the current authenticated user
   * RLS ensures user can only see their own household
   */
  async getHouseholdIdForCurrentUser(): Promise<QueryResult<string | null>> {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser()

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
   * RLS ensures user can only see their own household
   */
  async getHouseholdForCurrentUser(): Promise<QueryResult<any>> {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser()

    if (userError || !user) {
      return {
        data: null,
        error: new Error('Not authenticated'),
      }
    }

    // Get household via household_guardians
    const hgResult = await this.supabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!hgResult.data?.household_id) {
      // No household found
      return {
        data: null,
        error: null,
      }
    }

    // Fetch household
    const householdResult = await this.supabase
      .from('households')
      .select('*')
      .eq('id', hgResult.data.household_id)
      .maybeSingle()

    if (householdResult.error) {
      return handleSupabaseError(householdResult)
    }

    return {
      data: householdResult.data || null,
      error: null,
    }
  }

  /**
   * Get all guardians for a household (with profile info)
   * RLS ensures user can only see guardians in their own household
   */
  async getGuardiansForHousehold(householdId: string): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('household_guardians')
      .select(`
        id,
        household_id,
        user_id,
        is_primary,
        created_at,
        profiles:user_id (
          id,
          email,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('household_id', householdId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: result.data || [],
      error: null,
    }
  }

  /**
   * Get pending invitations for a household
   * RLS ensures only primary guardians can view invitations
   */
  async getPendingInvitationsForHousehold(householdId: string): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('guardian_invitations')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: result.data || [],
      error: null,
    }
  }

  /**
   * Check if a user is a guardian in any household
   */
  async isUserGuardianInAnyHousehold(userId: string): Promise<QueryResult<boolean>> {
    const result = await this.supabase.rpc('is_user_guardian_in_any_household', {
      p_user_id: userId,
    })

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: result.data || false,
      error: null,
    }
  }

  /**
   * Get guardian count for a household (including pending invitations)
   */
  async getGuardianCountForHousehold(householdId: string): Promise<QueryResult<number>> {
    const result = await this.supabase.rpc('get_household_guardian_count', {
      p_household_id: householdId,
    })

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: result.data || 0,
      error: null,
    }
  }

  /**
   * Remove a secondary guardian from household
   * Only primary guardians can remove secondary guardians
   */
  async removeGuardian(guardianId: string): Promise<QueryResult<void>> {
    // First verify this is not the primary guardian
    const { data: guardian, error: fetchError } = await this.supabase
      .from('household_guardians')
      .select('is_primary')
      .eq('id', guardianId)
      .single()

    if (fetchError) {
      return handleSupabaseError({ error: fetchError } as any)
    }

    if (guardian?.is_primary) {
      return {
        data: undefined,
        error: new Error('Cannot remove primary guardian'),
      }
    }

    const result = await this.supabase
      .from('household_guardians')
      .delete()
      .eq('id', guardianId)

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: undefined,
      error: null,
    }
  }

  /**
   * Cancel a pending invitation
   * Only primary guardians can cancel invitations
   */
  async cancelInvitation(invitationId: string): Promise<QueryResult<void>> {
    const result = await this.supabase
      .from('guardian_invitations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', invitationId)
      .eq('status', 'pending')

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: undefined,
      error: null,
    }
  }

  /**
   * Get invitation by ID (for resending)
   * Only primary guardians can access invitations for their household
   */
  async getInvitationById(invitationId: string): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('guardian_invitations')
      .select('*')
      .eq('id', invitationId)
      .maybeSingle()

    if (result.error) {
      return handleSupabaseError(result)
    }

    return {
      data: result.data || null,
      error: null,
    }
  }
}

export const householdGuardiansService = new HouseholdGuardiansService(getServiceClient())
