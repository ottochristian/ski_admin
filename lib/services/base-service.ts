import { supabase } from '../supabaseClient'

/**
 * Base service class with common database operations
 * All service classes should extend this for consistent patterns
 */
export class BaseService {
  protected supabase = supabase

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

