/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based solution like @upstash/ratelimit
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitRecord>()

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }, 5 * 60 * 1000) // 5 minutes
}

/**
 * Check if request is within rate limit
 * 
 * @param key - Unique identifier (e.g., user ID, IP address)
 * @param limit - Maximum number of requests
 * @param windowMs - Time window in milliseconds
 * @returns true if within limit, false if rate limited
 * 
 * @example
 * // 10 requests per minute
 * const allowed = rateLimit(userId, 10, 60 * 1000)
 * if (!allowed) {
 *   return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
 * }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    // New key or window expired - reset
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    // Rate limit exceeded
    return false
  }

  // Increment count
  record.count++
  return true
}

/**
 * Get rate limit status for a key
 * Useful for returning remaining requests to client
 */
export function getRateLimitStatus(
  key: string,
  limit: number,
  windowMs: number
): {
  allowed: boolean
  remaining: number
  resetTime: number | null
} {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    return {
      allowed: true,
      remaining: limit,
      resetTime: now + windowMs,
    }
  }

  return {
    allowed: record.count < limit,
    remaining: Math.max(0, limit - record.count),
    resetTime: record.resetTime,
  }
}

/**
 * Clear rate limit for a key (useful for testing or manual reset)
 */
export function clearRateLimit(key: string): void {
  rateLimitMap.delete(key)
}

/**
 * Get client identifier from request
 * Prefers user ID if authenticated, falls back to IP
 */
export function getRateLimitKey(request: Request): string {
  // In a real implementation, you might:
  // 1. Get user ID from authenticated session
  // 2. Fall back to IP address
  // 3. Use a combination of both for stricter limiting
  
  // For now, we'll use IP address
  // In Next.js middleware, you can get IP from headers
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  
  return `ip:${ip}`
}

/**
 * Rate limit configuration presets
 */
export const RateLimitPresets = {
  /** 5 attempts per minute - for login endpoints */
  LOGIN: { limit: 5, windowMs: 60 * 1000 },
  
  /** 3 attempts per hour - for signup endpoints */
  SIGNUP: { limit: 3, windowMs: 60 * 60 * 1000 },
  
  /** 10 requests per minute - for checkout endpoints */
  CHECKOUT: { limit: 10, windowMs: 60 * 1000 },
  
  /** 100 requests per minute - for general API endpoints */
  API: { limit: 100, windowMs: 60 * 1000 },
  
  /** 1000 requests per minute - for high-traffic endpoints */
  HIGH_TRAFFIC: { limit: 1000, windowMs: 60 * 1000 },
} as const

/**
 * Helper to create rate limit middleware for API routes
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const key = getRateLimitKey(request)
 *   if (!rateLimit(key, ...RateLimitPresets.CHECKOUT)) {
 *     return NextResponse.json(
 *       { error: 'Rate limit exceeded. Please try again later.' },
 *       { status: 429 }
 *     )
 *   }
 *   // ... rest of handler
 * }
 */
export function checkRateLimit(
  request: Request,
  preset: { limit: number; windowMs: number }
): { allowed: boolean; response?: Response } {
  const key = getRateLimitKey(request)
  const allowed = rateLimit(key, preset.limit, preset.windowMs)

  if (!allowed) {
    const status = getRateLimitStatus(key, preset.limit, preset.windowMs)
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((status.resetTime! - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(
              ((status.resetTime || Date.now()) - Date.now()) / 1000
            ).toString(),
          },
        }
      ),
    }
  }

  return { allowed: true }
}
