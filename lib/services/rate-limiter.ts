/**
 * Rate Limiter Service
 * 
 * Prevents abuse by limiting the number of requests per user/IP
 * 
 * Phase 1: In-memory rate limiting (simple, works for single-instance)
 * Phase 2: Redis-based rate limiting (for distributed systems)
 */

interface RateLimitRecord {
  count: number
  resetAt: Date
}

class RateLimiter {
  private store: Map<string, RateLimitRecord>
  private cleanupInterval: NodeJS.Timeout | null

  constructor() {
    this.store = new Map()
    
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  /**
   * Check if a request should be allowed
   * @param key Unique identifier (userId, IP, email, etc.)
   * @param limit Maximum number of requests allowed
   * @param windowMs Time window in milliseconds
   * @returns Object with allowed status and remaining requests
   */
  check(
    key: string,
    limit: number,
    windowMs: number
  ): {
    allowed: boolean
    remaining: number
    resetAt: Date
  } {
    const now = Date.now()
    const record = this.store.get(key)

    // No record or expired record
    if (!record || record.resetAt.getTime() <= now) {
      const resetAt = new Date(now + windowMs)
      this.store.set(key, { count: 1, resetAt })
      
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt
      }
    }

    // Record exists and not expired
    if (record.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt
      }
    }

    // Increment count
    record.count++
    
    return {
      allowed: true,
      remaining: limit - record.count,
      resetAt: record.resetAt
    }
  }

  /**
   * Check OTP request rate limit
   * Default: 5 requests per hour per user
   */
  checkOTPRequest(userId: string): {
    allowed: boolean
    remaining: number
    resetAt: Date
  } {
    const limit = parseInt(process.env.OTP_RATE_LIMIT_PER_HOUR || '5')
    const windowMs = 60 * 60 * 1000  // 1 hour
    
    return this.check(`otp:${userId}`, limit, windowMs)
  }

  /**
   * Check OTP request rate limit by IP
   * Default: 20 requests per hour per IP
   */
  checkOTPRequestByIP(ipAddress: string): {
    allowed: boolean
    remaining: number
    resetAt: Date
  } {
    const limit = 20
    const windowMs = 60 * 60 * 1000  // 1 hour
    
    return this.check(`otp:ip:${ipAddress}`, limit, windowMs)
  }

  /**
   * Check OTP request rate limit by contact (email/phone)
   * Default: 5 requests per hour per contact
   */
  checkOTPRequestByContact(contact: string): {
    allowed: boolean
    remaining: number
    resetAt: Date
  } {
    const limit = parseInt(process.env.OTP_RATE_LIMIT_PER_HOUR || '5')
    const windowMs = 60 * 60 * 1000  // 1 hour
    
    return this.check(`otp:contact:${contact}`, limit, windowMs)
  }

  /**
   * Check failed OTP attempts
   * Default: 10 failures per 24 hours (then account lock)
   */
  checkFailedOTPAttempts(userId: string): {
    allowed: boolean
    remaining: number
    resetAt: Date
  } {
    const limit = parseInt(process.env.MAX_FAILED_OTP_PER_DAY || '10')
    const windowMs = 24 * 60 * 60 * 1000  // 24 hours
    
    return this.check(`otp:failed:${userId}`, limit, windowMs)
  }

  /**
   * Record a failed OTP attempt
   */
  recordFailedOTPAttempt(userId: string): void {
    const key = `otp:failed:${userId}`
    const limit = parseInt(process.env.MAX_FAILED_OTP_PER_DAY || '10')
    const windowMs = 24 * 60 * 60 * 1000  // 24 hours
    
    this.check(key, limit, windowMs)
  }

  /**
   * Check signup rate limit by IP
   * Default: 10 signups per hour per IP
   */
  checkSignupByIP(ipAddress: string): {
    allowed: boolean
    remaining: number
    resetAt: Date
  } {
    const limit = 10
    const windowMs = 60 * 60 * 1000  // 1 hour
    
    return this.check(`signup:ip:${ipAddress}`, limit, windowMs)
  }

  /**
   * Check login attempts rate limit
   * Default: 50 login attempts per hour per IP
   */
  checkLoginByIP(ipAddress: string): {
    allowed: boolean
    remaining: number
    resetAt: Date
  } {
    const limit = 50
    const windowMs = 60 * 60 * 1000  // 1 hour
    
    return this.check(`login:ip:${ipAddress}`, limit, windowMs)
  }

  /**
   * Reset rate limit for a specific key
   * Useful for clearing limits after successful actions
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Reset OTP rate limit for a user
   */
  resetOTPLimit(userId: string): void {
    this.reset(`otp:${userId}`)
  }

  /**
   * Reset failed OTP attempts for a user
   */
  resetFailedOTPAttempts(userId: string): void {
    this.reset(`otp:failed:${userId}`)
  }

  /**
   * Get time remaining until rate limit resets
   */
  getTimeRemaining(key: string): number | null {
    const record = this.store.get(key)
    if (!record) return null
    
    const now = Date.now()
    const resetTime = record.resetAt.getTime()
    
    if (resetTime <= now) return null
    
    return resetTime - now
  }

  /**
   * Clean up expired records
   */
  private cleanup(): void {
    const now = Date.now()
    
    for (const [key, record] of this.store.entries()) {
      if (record.resetAt.getTime() <= now) {
        this.store.delete(key)
      }
    }
    
    console.log(`🧹 Rate limiter cleanup: ${this.store.size} active records`)
  }

  /**
   * Get current store size (for monitoring)
   */
  getSize(): number {
    return this.store.size
  }

  /**
   * Clear all rate limits (for testing only)
   */
  clearAll(): void {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Attempted to clear rate limits in production!')
      return
    }
    
    this.store.clear()
    console.log('🧹 All rate limits cleared (testing only)')
  }

  /**
   * Destroy the rate limiter (cleanup interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()

// Clean up on process exit
process.on('beforeExit', () => {
  rateLimiter.destroy()
})
