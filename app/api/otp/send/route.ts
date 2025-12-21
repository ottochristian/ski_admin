import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { otpService, OTPType } from '@/lib/services/otp-service'
import { notificationService } from '@/lib/services/notification-service'
import { rateLimiter } from '@/lib/services/rate-limiter'

// Helper to get Supabase admin client
function getSupabaseAdmin() {
  return createClient(
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

// Helper to get client IP address
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, contact, metadata } = body

    // Validate required fields
    if (!userId || !type || !contact) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, contact' },
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

    // Get client IP and user agent
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check rate limits
    const userRateLimit = rateLimiter.checkOTPRequest(userId)
    if (!userRateLimit.allowed) {
      const minutesRemaining = Math.ceil((userRateLimit.resetAt.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { 
          error: `Too many OTP requests. Please try again in ${minutesRemaining} minute(s).`,
          resetAt: userRateLimit.resetAt.toISOString()
        },
        { status: 429 }
      )
    }

    const ipRateLimit = rateLimiter.checkOTPRequestByIP(ipAddress)
    if (!ipRateLimit.allowed) {
      const minutesRemaining = Math.ceil((ipRateLimit.resetAt.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { 
          error: `Too many requests from this IP. Please try again in ${minutesRemaining} minute(s).`,
          resetAt: ipRateLimit.resetAt.toISOString()
        },
        { status: 429 }
      )
    }

    const contactRateLimit = rateLimiter.checkOTPRequestByContact(contact)
    if (!contactRateLimit.allowed) {
      const minutesRemaining = Math.ceil((contactRateLimit.resetAt.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { 
          error: `Too many requests for this ${type.includes('email') ? 'email' : 'phone number'}. Please try again in ${minutesRemaining} minute(s).`,
          resetAt: contactRateLimit.resetAt.toISOString()
        },
        { status: 429 }
      )
    }

    // Generate OTP
    const otpResult = await otpService.generate(
      userId,
      type,
      contact,
      undefined,
      {
        ipAddress,
        userAgent
      }
    )

    if (!otpResult.success || !otpResult.code) {
      return NextResponse.json(
        { error: otpResult.error || 'Failed to generate OTP' },
        { status: 500 }
      )
    }

    // Send OTP based on type
    let notificationResult
    
    switch (type) {
      case 'email_verification':
        notificationResult = await notificationService.sendEmailVerificationOTP(
          contact,
          otpResult.code,
          metadata?.firstName
        )
        break
        
      case 'phone_verification':
        notificationResult = await notificationService.sendPhoneVerificationOTP(
          contact,
          otpResult.code
        )
        break
        
      case 'admin_invitation':
        notificationResult = await notificationService.sendAdminInvitationOTP(
          contact,
          otpResult.code,
          {
            firstName: metadata?.firstName,
            clubName: metadata?.clubName || 'Ski Admin',
            setupLink: metadata?.setupLink || `${process.env.NEXT_PUBLIC_APP_URL}/setup-password`
          }
        )
        break
        
      case 'password_reset':
        notificationResult = await notificationService.sendPasswordResetOTP(
          contact,
          otpResult.code
        )
        break
        
      default:
        // For 2FA and other types, send generic OTP
        notificationResult = await notificationService.send({
          method: type.includes('phone') ? 'sms' : 'email',
          recipient: contact,
          message: `Your verification code is: ${otpResult.code}. Valid for 10 minutes.`,
          code: otpResult.code
        })
    }

    if (!notificationResult.success) {
      return NextResponse.json(
        { error: notificationResult.error || 'Failed to send OTP' },
        { status: 500 }
      )
    }

    // In development, include the code in the response for testing
    const responseData: any = {
      success: true,
      message: 'OTP sent successfully',
      expiresAt: otpResult.expiresAt,
      attemptsRemaining: userRateLimit.remaining
    }

    if (process.env.NODE_ENV === 'development') {
      responseData.code = otpResult.code  // Only in development!
      responseData._devNote = 'Code included for development only'
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('OTP send error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
