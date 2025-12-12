import { BaseService, handleSupabaseError, QueryResult } from './base-service'

/**
 * Service for registration-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class RegistrationsService extends BaseService {
  /**
   * Get all registrations for the authenticated user's club
   * RLS automatically filters by club - no manual filtering needed!
   */
  async getRegistrations(seasonId?: string): Promise<QueryResult<any[]>> {
    let query = this.supabase.from('registrations').select(`
      id,
      athlete_id,
      sub_program_id,
      status,
      payment_status,
      amount_paid,
      created_at,
      season_id,
      athletes(id, first_name, last_name, date_of_birth, household_id, family_id),
      sub_programs(name, programs(name))
    `)

    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query.order('created_at', { ascending: false })

    return handleSupabaseError(result)
  }

  /**
   * Get recent registrations (limit)
   * RLS automatically filters by club
   */
  async getRecentRegistrations(
    seasonId: string,
    limit: number = 5
  ): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('registrations')
      .select(`
        id,
        status,
        athletes(first_name, last_name),
        sub_programs(name, programs(name))
      `)
      .eq('season_id', seasonId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return handleSupabaseError(result)
  }

  /**
   * Count registrations
   * RLS automatically filters by club
   */
  async countRegistrations(seasonId?: string): Promise<QueryResult<number>> {
    let query = this.supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })

    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message || 'Failed to count registrations'),
      }
    }

    return {
      data: result.count || 0,
      error: null,
    }
  }

  /**
   * Get total revenue from confirmed registrations
   * RLS automatically filters by club
   */
  async getTotalRevenue(seasonId?: string): Promise<QueryResult<number>> {
    let query = this.supabase
      .from('registrations')
      .select('amount_paid, status')
      .eq('status', 'confirmed')

    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message || 'Failed to get total revenue'),
      }
    }

    const totalRevenue =
      (result.data || []).reduce(
        (sum: number, reg: any) => sum + Number(reg.amount_paid || 0),
        0
      ) || 0

    return {
      data: totalRevenue,
      error: null,
    }
  }
}

export const registrationsService = new RegistrationsService()

