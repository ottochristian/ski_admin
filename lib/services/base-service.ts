import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Base service class with common database operations
 * All service classes should extend this for consistent patterns
 * 
 * ARCHITECTURE: Services now use dependency injection for the Supabase client.
 * This allows the same service to work in different contexts:
 * - Client components: Pass browser client from createClient()
 * - API routes: Pass admin client from createAdminClient()
 * - Server components: Pass server client from createClient()
 * - Tests: Pass mock client
 * 
 * This is proper dependency injection and makes services testable and flexible.
 */
export class BaseService {
  protected supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Standard error handler - can be overridden in subclasses
   */
  protected handleError(error: unknown): Error {
    if (error instanceof Error) {
      console.error('Service error:', error)
      return error
    }
    console.error('Unknown service error:', error)
    return new Error('An unknown error occurred')
  }
}

/**
 * Type helper for Supabase query responses
 */
export type QueryResult<T> = {
  data: T | null
  error: Error | null
}

/**
 * Helper to convert Supabase errors to standard Error objects
 */
export function handleSupabaseError<T>(
  result: { data: T | null; error: any }
): QueryResult<T> {
  if (result.error) {
    return {
      data: null,
      error: new Error(result.error.message || 'Database error occurred'),
    }
  }
  return {
    data: result.data,
    error: null,
  }
}


