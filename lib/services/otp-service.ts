import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// OTP types
export type OTPType = 
  | 'email_verification'
  | 'phone_verification'
  | 'admin_invitation'
  | 'password_reset'
  | '2fa_login'

export interface OTPConfig {
  expiryMinutes?: number
  maxAttempts?: number
  length?: number
}

export interface GenerateOTPResult {
  success: boolean
  code?: string
  error?: string
  expiresAt?: Date
}

export interface VerifyOTPResult {
  success: boolean
  message: string
  attemptsRemaining?: number
}

class OTPService {
  private supabase

  constructor() {
    // Use service role for admin operations
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }

  /**
   * Generate a secure 6-digit OTP code
   */
  private generateCode(length: number = 6): string {
    // Generate cryptographically secure random number
    const min = Math.pow(10, length - 1)
    const max = Math.pow(10, length) - 1
    const randomValue = crypto.randomInt(min, max + 1)
    
    // Convert to string and pad with zeros if needed
    return randomValue.toString().padStart(length, '0')
  }

  /**
   * Generate and store an OTP code
   */
  async generate(
    userId: string,
    type: OTPType,
    contact: string,
    config?: OTPConfig,
    metadata?: {
      ipAddress?: string
      userAgent?: string
    }
  ): Promise<GenerateOTPResult> {
    try {
      const code = this.generateCode(config?.length || 6)
      
      // Calculate expiry time
      let expiryMinutes = config?.expiryMinutes || parseInt(process.env.OTP_EXPIRY_MINUTES || '10')
      
      // Admin invitations have longer expiry (24 hours)
      if (type === 'admin_invitation') {
        expiryMinutes = parseInt(process.env.OTP_ADMIN_INVITATION_EXPIRY_HOURS || '24') * 60
      }
      
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)
      
      // Invalidate any existing active codes for this user/type/contact
      const { error: invalidateError } = await this.supabase
        .from('verification_codes')
        .update({ verified_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('type', type)
        .eq('contact', contact)
        .is('verified_at', null)

      if (invalidateError) {
        console.error('Error invalidating old codes:', invalidateError)
        // Don't fail if this errors, just log it
      }

      // Insert new verification code
      const { error: insertError } = await this.supabase
        .from('verification_codes')
        .insert({
          user_id: userId,
          code,
          type,
          contact,
          expires_at: expiresAt.toISOString(),
          max_attempts: config?.maxAttempts || parseInt(process.env.OTP_MAX_ATTEMPTS || '3'),
          ip_address: metadata?.ipAddress || null,
          user_agent: metadata?.userAgent || null
        })

      if (insertError) {
        console.error('Error inserting OTP:', insertError)
        return {
          success: false,
          error: 'Failed to generate verification code'
        }
      }

      return {
        success: true,
        code,
        expiresAt
      }
    } catch (error) {
      console.error('OTP generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Verify an OTP code using the database function
   */
  async verify(
    userId: string,
    code: string,
    type: OTPType,
    contact: string
  ): Promise<VerifyOTPResult> {
    try {
      // Call the database function
      const { data, error } = await this.supabase
        .rpc('validate_otp_code', {
          p_user_id: userId,
          p_code: code,
          p_type: type,
          p_contact: contact
        })
        .single()

      if (error) {
        console.error('OTP verification error:', error)
        return {
          success: false,
          message: 'Verification failed. Please try again.'
        }
      }

      return {
        success: data.success,
        message: data.message,
        attemptsRemaining: data.attempts_remaining
      }
    } catch (error) {
      console.error('OTP verification exception:', error)
      return {
        success: false,
        message: 'An error occurred during verification'
      }
    }
  }

  /**
   * Check if a code exists and is valid (without verifying it)
   */
  async exists(
    userId: string,
    type: OTPType,
    contact: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('verification_codes')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('contact', contact)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error checking OTP existence:', error)
        return false
      }

      return data && data.length > 0
    } catch (error) {
      console.error('OTP existence check exception:', error)
      return false
    }
  }

  /**
   * Get the most recent OTP for a user (for debugging/testing only)
   */
  async getRecent(
    userId: string,
    type: OTPType,
    contact: string
  ): Promise<{ code: string; expiresAt: Date } | null> {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from('verification_codes')
        .select('code, expires_at')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('contact', contact)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      return {
        code: data.code,
        expiresAt: new Date(data.expires_at)
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Clean up expired codes (call this via cron job)
   */
  async cleanup(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .rpc('cleanup_expired_verification_codes')

      if (error) {
        console.error('Error cleaning up OTP codes:', error)
        return 0
      }

      return data || 0
    } catch (error) {
      console.error('OTP cleanup exception:', error)
      return 0
    }
  }

  /**
   * Check verification status for a user
   */
  async checkVerificationStatus(userId: string): Promise<{
    emailVerified: boolean
    phoneVerified: boolean
    needsEmailVerification: boolean
    needsPhoneVerification: boolean
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_verification_status', {
          p_user_id: userId
        })
        .single()

      if (error || !data) {
        // Default to needing verification if we can't check
        return {
          emailVerified: false,
          phoneVerified: false,
          needsEmailVerification: true,
          needsPhoneVerification: false
        }
      }

      return {
        emailVerified: data.email_verified,
        phoneVerified: data.phone_verified,
        needsEmailVerification: data.needs_email_verification,
        needsPhoneVerification: data.needs_phone_verification
      }
    } catch (error) {
      console.error('Error checking verification status:', error)
      return {
        emailVerified: false,
        phoneVerified: false,
        needsEmailVerification: true,
        needsPhoneVerification: false
      }
    }
  }
}

// Export singleton instance
export const otpService = new OTPService()
