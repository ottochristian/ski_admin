import twilio from 'twilio'

// Notification types
export type NotificationMethod = 'email' | 'sms' | 'both'

export interface NotificationOptions {
  method: NotificationMethod
  recipient: string  // Email or phone number
  phoneNumber?: string  // If method is 'both'
  subject?: string
  message: string
  code?: string  // OTP code
  link?: string  // Verification or action link
  template?: 'otp' | 'invitation' | 'password-reset' | 'confirmation'
}

export interface NotificationResult {
  success: boolean
  emailSent?: boolean
  smsSent?: boolean
  error?: string
}

class NotificationService {
  private twilioClient?: ReturnType<typeof twilio>
  private smsEnabled: boolean

  constructor() {
    // Initialize Twilio only if credentials are provided
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    
    if (accountSid && authToken) {
      try {
        this.twilioClient = twilio(accountSid, authToken)
        this.smsEnabled = true
        console.log('✅ Twilio SMS service initialized')
      } catch (error) {
        console.error('❌ Twilio initialization failed:', error)
        this.smsEnabled = false
      }
    } else {
      this.smsEnabled = false
      console.log('⚠️ Twilio not configured - SMS disabled')
    }
  }

  /**
   * Send a notification via email, SMS, or both
   */
  async send(options: NotificationOptions): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: true,
      emailSent: false,
      smsSent: false
    }

    try {
      // Send email
      if (options.method === 'email' || options.method === 'both') {
        await this.sendEmail(options)
        result.emailSent = true
      }

      // Send SMS (only if enabled)
      if ((options.method === 'sms' || options.method === 'both') && this.smsEnabled) {
        const phone = options.method === 'both' ? options.phoneNumber! : options.recipient
        await this.sendSMS({
          to: phone,
          message: options.message,
          code: options.code
        })
        result.smsSent = true
      }

      return result
    } catch (error) {
      console.error('Notification error:', error)
      return {
        success: false,
        emailSent: result.emailSent,
        smsSent: result.smsSent,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send OTP code for email verification
   */
  async sendEmailVerificationOTP(email: string, code: string, firstName?: string): Promise<NotificationResult> {
    const message = this.buildEmailOTPMessage(code, firstName, 'email verification')
    
    return this.send({
      method: 'email',
      recipient: email,
      subject: 'Verify Your Email',
      message,
      code,
      template: 'otp'
    })
  }

  /**
   * Send OTP code for phone verification
   */
  async sendPhoneVerificationOTP(phone: string, code: string): Promise<NotificationResult> {
    if (!this.smsEnabled) {
      return {
        success: false,
        error: 'SMS is not enabled. Please configure Twilio.'
      }
    }

    const message = `Your verification code is: ${code}. Valid for 10 minutes.`
    
    return this.send({
      method: 'sms',
      recipient: phone,
      message,
      code,
      template: 'otp'
    })
  }

  /**
   * Send admin invitation with OTP
   */
  async sendAdminInvitationOTP(
    email: string,
    code: string,
    options: {
      firstName?: string
      clubName: string
      setupLink: string
    }
  ): Promise<NotificationResult> {
    const message = this.buildAdminInvitationMessage(code, options)
    
    return this.send({
      method: 'email',
      recipient: email,
      subject: `Admin Invitation - ${options.clubName}`,
      message,
      code,
      link: options.setupLink,
      template: 'invitation'
    })
  }

  /**
   * Send password reset OTP
   */
  async sendPasswordResetOTP(email: string, code: string): Promise<NotificationResult> {
    const message = this.buildPasswordResetMessage(code)
    
    return this.send({
      method: 'email',
      recipient: email,
      subject: 'Reset Your Password',
      message,
      code,
      template: 'password-reset'
    })
  }

  /**
   * Send email (via Supabase for now, can switch to Resend later)
   */
  private async sendEmail(options: NotificationOptions): Promise<void> {
    // For Phase 1, we'll log to console
    // In Phase 2, we'll implement actual email sending via Resend
    
    console.log('📧 Email would be sent to:', options.recipient)
    console.log('📧 Subject:', options.subject)
    console.log('📧 Message:', options.message)
    
    // TODO Phase 2: Implement Resend email sending
    // const { Resend } = await import('resend')
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: process.env.RESEND_FROM_EMAIL!,
    //   to: options.recipient,
    //   subject: options.subject || 'Notification',
    //   html: this.buildEmailHTML(options)
    // })
  }

  /**
   * Send SMS via Twilio
   */
  private async sendSMS(options: {
    to: string
    message: string
    code?: string
  }): Promise<void> {
    if (!this.twilioClient || !this.smsEnabled) {
      throw new Error('SMS is not enabled. Please configure Twilio.')
    }

    const fromNumber = process.env.TWILIO_PHONE_NUMBER
    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER is not configured')
    }

    // Format phone number (must include country code)
    const formattedPhone = this.formatPhoneNumber(options.to)

    // Truncate message if too long (SMS limit is 160 chars)
    let fullMessage = options.message
    if (fullMessage.length > 160) {
      fullMessage = fullMessage.substring(0, 157) + '...'
    }

    await this.twilioClient.messages.create({
      body: fullMessage,
      from: fromNumber,
      to: formattedPhone
    })

    console.log('📱 SMS sent to:', formattedPhone)
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '')
    
    // If it already starts with country code, just add +
    if (phone.startsWith('+')) {
      return phone
    }
    
    // Assume US if no country code (default for Phase 1)
    if (cleaned.length === 10) {
      return `+1${cleaned}`
    }
    
    // Already has country code
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`
    }
    
    return `+${cleaned}`
  }

  /**
   * Build email OTP message
   */
  private buildEmailOTPMessage(code: string, firstName?: string, purpose: string): string {
    const greeting = firstName ? `Hi ${firstName},` : 'Hello,'
    
    return `
${greeting}

Your verification code for ${purpose} is:

${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Thanks,
The Ski Admin Team
    `.trim()
  }

  /**
   * Build admin invitation message
   */
  private buildAdminInvitationMessage(
    code: string,
    options: { firstName?: string; clubName: string; setupLink: string }
  ): string {
    const greeting = options.firstName ? `Hi ${options.firstName},` : 'Hello,'
    
    return `
${greeting}

You've been invited to join ${options.clubName} as an administrator!

Your verification code is: ${code}

To complete your setup:
1. Visit: ${options.setupLink}
2. Enter the code above
3. Create your password
4. Start managing your club!

This code will expire in 24 hours.

If you didn't expect this invitation, please ignore this email.

Questions? Contact support.

Thanks,
The ${options.clubName} Team
    `.trim()
  }

  /**
   * Build password reset message
   */
  private buildPasswordResetMessage(code: string): string {
    return `
Hello,

You requested to reset your password.

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email and your password will remain unchanged.

Thanks,
The Ski Admin Team
    `.trim()
  }

  /**
   * Build HTML email (for future Resend integration)
   */
  private buildEmailHTML(options: NotificationOptions): string {
    const { code, message, subject } = options
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject || 'Notification'}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .code { font-size: 32px; font-weight: bold; color: #3B82F6; letter-spacing: 4px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div style="white-space: pre-line;">${message}</div>
    ${code ? `<div class="code">${code}</div>` : ''}
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
