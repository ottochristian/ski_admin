import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { Profile } from '../types'

/**
 * Service for profile-related database operations
 */
export class ProfilesService extends BaseService {
  /**
   * Get profile by user ID
   */
  async getProfile(userId: string): Promise<QueryResult<Profile>> {
    const result = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Get profile by email
   */
  async getProfileByEmail(email: string): Promise<QueryResult<Profile>> {
    const result = await this.supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Update profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<Profile>
  ): Promise<QueryResult<Profile>> {
    const result = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    return handleSupabaseError(result)
  }
}

export const profilesService = new ProfilesService()

