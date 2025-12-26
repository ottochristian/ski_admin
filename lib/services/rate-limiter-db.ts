import { createClient } from '@supabase/supabase-js'

/**
 * Database-backed rate limiter
 * Production-ready with persistence and multi-instance support
 */

interface RateLimitResult {
  allowed: boolean
  currentCount: number
  maxRequests: number
  resetAt: Date
}

interface RateLimitConfig {
  maxRequests: number
  windowMinutes: number
}

class DatabaseRateLimiter {
  private supabaseAdmin: ReturnType<typeof createClient>

  // Rate limit configurations
  private readonly config = {
    otpPerUser: { maxRequests: 3, windowMinutes: 60 },
    otpPerIP: { maxRequests: 10, windowMinutes: 60 },
    otpPerContact: { maxRequests: 3, windowMinutes: 60 },
    failedOTP: { maxRequests: 5, windowMinutes: 1440 }, // 24 hours
    loginPerIP: { maxRequests: 10, windowMinutes: 15 },
    loginPerEmail: { maxRequests: 5, windowMinutes: 15 },
    signupPerIP: { maxRequests: 3, windowMinutes: 60 }
  }

  constructor() {
    // Initialize Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured')
    }

    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  /**
   * Check rate limit using database function
   * Thread-safe with row-level locking
   */
  private async checkLimit(
    identifier: string,
    action: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      const { data, error } = await this.supabaseAdmin.rpc('check_rate_limit', {
        p_identifier: identifier,
        p_action: action,
        p_max_requests: config.maxRequests,
        p_window_minutes: config.windowMinutes
      })

      if (error) {
        console.error('Rate limit check error:', error)
        // Fail open - allow request on error (but log it)
        return {
          allowed: true,
          currentCount: 0,
          maxRequests: config.maxRequests,
          resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000)
        }
      }

      return {
        allowed: data.allowed,
        currentCount: data.current_count,
        maxRequests: data.max_requests,
        resetAt: new Date(data.reset_at)
      }
    } catch (error) {
      console.error('Rate limit exception:', error)
      // Fail open on exception
      return {
        allowed: true,
        currentCount: 0,
        maxRequests: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000)
      }
    }
  }

  /**
   * Check OTP request rate limit by user ID
   */
  async checkOTPRequestByUser(userId: string): Promise<RateLimitResult> {
    return this.checkLimit(
      `user:${userId}`,
      'otp_request',
      this.config.otpPerUser
    )
  }

  /**
   * Check OTP request rate limit by IP address
   */
  async checkOTPRequestByIP(ipAddress: string): Promise<RateLimitResult> {
    return this.checkLimit(
      `ip:${ipAddress}`,
      'otp_request',
      this.config.otpPerIP
    )
  }

  /**
   * Check OTP request rate limit by contact (email/phone)
   */
  async checkOTPRequestByContact(contact: string): Promise<RateLimitResult> {
    return this.checkLimit(
      `contact:${contact.toLowerCase()}`,
      'otp_request',
      this.config.otpPerContact
    )
  }

  /**
   * Check failed OTP attempts (account lockout prevention)
   */
  async checkFailedOTPAttempts(userId: string): Promise<RateLimitResult> {
    return this.checkLimit(
      `user:${userId}`,
      'failed_otp',
      this.config.failedOTP
    )
  }

  /**
   * Record a failed OTP attempt
   */
  async recordFailedOTPAttempt(userId: string): Promise<void> {
    await this.checkLimit(
      `user:${userId}`,
      'failed_otp',
      this.config.failedOTP
    )
  }

  /**
   * Reset failed OTP attempts counter (on successful verification)
   */
  async resetFailedOTPAttempts(userId: string): Promise<void> {
    try {
      await this.supabaseAdmin
        .from('rate_limits')
        .delete()
        .eq('identifier', `user:${userId}`)
        .eq('action', 'failed_otp')
    } catch (error) {
      console.error('Error resetting failed attempts:', error)
    }
  }

  /**
   * Check login attempts by IP address
   */
  async checkLoginByIP(ipAddress: string): Promise<RateLimitResult> {
    return this.checkLimit(
      `ip:${ipAddress}`,
      'login_attempt',
      this.config.loginPerIP
    )
  }

  /**
   * Check login attempts by email
   */
  async checkLoginByEmail(email: string): Promise<RateLimitResult> {
    return this.checkLimit(
      `email:${email.toLowerCase()}`,
      'login_attempt',
      this.config.loginPerEmail
    )
  }

  /**
   * Check signup attempts by IP address
   */
  async checkSignupByIP(ipAddress: string): Promise<RateLimitResult> {
    return this.checkLimit(
      `ip:${ipAddress}`,
      'signup_attempt',
      this.config.signupPerIP
    )
  }

  /**
   * Cleanup expired rate limits (should be called by cron job)
   */
  async cleanup(): Promise<void> {
    try {
      const { error } = await this.supabaseAdmin.rpc('cleanup_expired_rate_limits')
      if (error) {
        console.error('Rate limit cleanup error:', error)
      }
    } catch (error) {
      console.error('Rate limit cleanup exception:', error)
    }
  }
}

// Export singleton instance
export const dbRateLimiter = new DatabaseRateLimiter()
export type { RateLimitResult }
