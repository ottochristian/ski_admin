/**
 * Pagination utilities for database queries
 */

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Calculate pagination range for Supabase queries.
 * 
 * @example
 * const { from, to } = getPaginationRange(1, 50) // { from: 0, to: 49 }
 * const { data } = await query.range(from, to)
 */
export function getPaginationRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { from, to }
}

/**
 * Parse pagination parameters from request URL search params.
 * Validates and provides defaults.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10))
  )

  return { page, pageSize }
}

/**
 * Calculate pagination metadata for response.
 */
export function calculatePaginationMeta(
  page: number,
  pageSize: number,
  total: number
) {
  const totalPages = Math.ceil(total / pageSize)

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}



