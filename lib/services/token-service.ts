import { SignJWT, jwtVerify } from 'jose'

/**
 * Secure token service for authentication flows
 * Uses JWT with HS256 signing
 */

interface InvitationTokenPayload {
  email: string
  userId: string
  type: 'admin_setup' | 'email_verification' | 'password_reset'
  clubId?: string
  iat: number
  exp: number
  jti: string // Unique token ID for replay prevention
}

interface TokenVerificationResult {
  valid: boolean
  payload?: InvitationTokenPayload
  error?: string
}

class TokenService {
  private secret: Uint8Array

  constructor() {
    const secretKey = process.env.JWT_SECRET_KEY
    if (!secretKey) {
      throw new Error('JWT_SECRET_KEY environment variable is required')
    }
    
    // Convert secret to Uint8Array for jose library
    this.secret = new TextEncoder().encode(secretKey)
  }

  /**
   * Generate a secure setup token for admin invitations
   * Token is time-limited and can only be used once
   */
  async generateSetupToken(params: {
    email: string
    userId: string
    type: 'admin_setup' | 'email_verification' | 'password_reset'
    clubId?: string
    expiresInHours?: number
  }): Promise<string> {
    const { email, userId, type, clubId, expiresInHours = 24 } = params

    // Generate unique token ID to prevent replay attacks
    const jti = `${type}_${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`

    const token = await new SignJWT({
      email: email.toLowerCase(),
      userId,
      type,
      clubId,
      jti
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${expiresInHours}h`)
      .setIssuer('ski-admin')
      .setAudience('setup-flow')
      .sign(this.secret)

    return token
  }

  /**
   * Verify and decode a setup token
   * Checks signature, expiration, and token format
   */
  async verifySetupToken(token: string): Promise<TokenVerificationResult> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'ski-admin',
        audience: 'setup-flow'
      })

      // Validate required fields
      if (!payload.email || !payload.userId || !payload.type || !payload.jti) {
        return {
          valid: false,
          error: 'Invalid token structure'
        }
      }

      return {
        valid: true,
        payload: payload as unknown as InvitationTokenPayload
      }
    } catch (error) {
      if (error instanceof Error) {
        // Token expired
        if (error.message.includes('exp')) {
          return {
            valid: false,
            error: 'Token has expired'
          }
        }
        
        // Invalid signature
        if (error.message.includes('signature')) {
          return {
            valid: false,
            error: 'Invalid token signature'
          }
        }

        return {
          valid: false,
          error: error.message
        }
      }

      return {
        valid: false,
        error: 'Token verification failed'
      }
    }
  }

  /**
   * Check if a token has been used (replay attack prevention)
   * Tokens can only be used once for security
   */
  async isTokenUsed(jti: string, supabaseAdmin: any): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('used_tokens')
      .select('id')
      .eq('jti', jti)
      .single()

    return !!data
  }

  /**
   * Mark a token as used to prevent replay attacks
   */
  async markTokenAsUsed(params: {
    jti: string
    userId: string
    type: string
    supabaseAdmin: any
  }): Promise<void> {
    const { jti, userId, type, supabaseAdmin } = params

    await supabaseAdmin
      .from('used_tokens')
      .insert({
        jti,
        user_id: userId,
        token_type: type,
        used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Keep for 30 days
      })
  }
}

// Export singleton
export const tokenService = new TokenService()
export type { InvitationTokenPayload, TokenVerificationResult }
