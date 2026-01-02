import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { otpService, OTPType } from '@/lib/services/otp-service'
import { notificationService } from '@/lib/services/notification-service'
import { dbRateLimiter } from '@/lib/services/rate-limiter-db'

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
    
    console.log('[OTP SEND] Request received:', { userId, type, contact, metadata })

    // Validate required fields
    if (!userId || !type || !contact) {
      console.log('[OTP SEND] Missing required fields')
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

    // Check rate limits (database-backed for production)
    const userRateLimit = await dbRateLimiter.checkOTPRequestByUser(userId)
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

    const ipRateLimit = await dbRateLimiter.checkOTPRequestByIP(ipAddress)
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

    const contactRateLimit = await dbRateLimiter.checkOTPRequestByContact(contact)
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
    console.log('[OTP SEND] Sending notification for type:', type)
    let notificationResult
    
    switch (type) {
      case 'email_verification':
        console.log('[OTP SEND] Calling sendEmailVerificationOTP...')
        notificationResult = await notificationService.sendEmailVerificationOTP(
          contact,
          otpResult.code,
          metadata?.firstName
        )
        console.log('[OTP SEND] Email verification OTP sent:', notificationResult)
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

    console.log('[OTP SEND] Notification result:', { success: notificationResult.success, error: notificationResult.error })

    if (!notificationResult.success) {
      console.log('[OTP SEND] Notification failed!', notificationResult.error)
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

    console.log('[OTP SEND] Success! Returning response')
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('OTP send error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
