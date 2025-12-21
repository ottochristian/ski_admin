import { NextRequest, NextResponse } from 'next/server'
import { otpService, OTPType } from '@/lib/services/otp-service'
import { rateLimiter } from '@/lib/services/rate-limiter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, code, type, contact } = body

    // Validate required fields
    if (!userId || !code || !type || !contact) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, code, type, contact' },
        { status: 400 }
      )
    }

    // Validate OTP type
    const validTypes: OTPType[] = ['email_verification', 'phone_verification', 'admin_invitation', 'password_reset', '2fa_login']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid OTP type' },
        { status: 400 }
      )
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Code must be 6 digits.' },
        { status: 400 }
      )
    }

    // Check failed attempts rate limit
    const failedAttemptsCheck = rateLimiter.checkFailedOTPAttempts(userId)
    if (!failedAttemptsCheck.allowed) {
      const hoursRemaining = Math.ceil((failedAttemptsCheck.resetAt.getTime() - Date.now()) / 3600000)
      return NextResponse.json(
        { 
          error: `Account temporarily locked due to too many failed attempts. Please try again in ${hoursRemaining} hour(s).`,
          resetAt: failedAttemptsCheck.resetAt.toISOString(),
          locked: true
        },
        { status: 429 }
      )
    }

    // Verify the OTP
    const result = await otpService.verify(userId, code, type, contact)

    if (!result.success) {
      // Record failed attempt
      rateLimiter.recordFailedOTPAttempt(userId)
      
      return NextResponse.json(
        { 
          success: false,
          error: result.message,
          attemptsRemaining: result.attemptsRemaining
        },
        { status: 400 }
      )
    }

    // Success! Reset failed attempts counter
    rateLimiter.resetFailedOTPAttempts(userId)

    return NextResponse.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    console.error('OTP verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
