import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { getServiceClient } from './service-client'

/**
 * Service for order-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class OrdersService extends BaseService {
  constructor(supabase = getServiceClient()) {
    super(supabase)
  }

  /**
   * Get orders for a household in a season
   * RLS automatically filters by club
   */
  async getOrdersByHousehold(
    householdId: string,
    seasonId?: string
  ): Promise<QueryResult<any[]>> {
    let query = this.supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        status,
        created_at,
        order_items (
          description,
          amount
        ),
        payments (
          amount,
          status,
          method,
          processed_at
        )
      `)
      .eq('household_id', householdId)

    if (seasonId) {
      query = query.eq('season_id', seasonId)
    }

    const result = await query.order('created_at', { ascending: false })

    return handleSupabaseError(result)
  }
}

export const ordersService = new OrdersService(getServiceClient())


