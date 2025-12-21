import twilio from 'twilio'
import sgMail from '@sendgrid/mail'

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
  private emailEnabled: boolean

  constructor() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:29',message:'NotificationService constructor start',data:{sendgridApiKeyExists:!!process.env.SENDGRID_API_KEY,sendgridApiKeyLength:process.env.SENDGRID_API_KEY?.length,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Initialize SendGrid for email
    const sendgridApiKey = process.env.SENDGRID_API_KEY
    if (sendgridApiKey) {
      try {
        sgMail.setApiKey(sendgridApiKey)
        this.emailEnabled = true
        console.log('✅ SendGrid email service initialized')
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:42',message:'SendGrid initialized successfully',data:{emailEnabled:true},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        console.error('❌ SendGrid initialization failed:', error)
        this.emailEnabled = false
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:49',message:'SendGrid initialization FAILED',data:{error:error instanceof Error?error.message:String(error),emailEnabled:false},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    } else {
      this.emailEnabled = false
      console.log('⚠️ SendGrid not configured - Email logging to console only')
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:57',message:'SendGrid NOT configured',data:{emailEnabled:false,sendgridApiKey:'undefined'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }

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
   * Send email via SendGrid (Twilio's email service)
   */
  private async sendEmail(options: NotificationOptions): Promise<void> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:208',message:'sendEmail called',data:{recipient:options.recipient,subject:options.subject,hasCode:!!options.code,emailEnabled:this.emailEnabled,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    const isDev = process.env.NODE_ENV === 'development'
    
    // Always log in development
    if (isDev) {
      console.log('📧 Email details:')
      console.log('  To:', options.recipient)
      console.log('  Subject:', options.subject)
      console.log('  Message:', options.message)
      if (options.code) {
        console.log('  OTP Code:', options.code)
      }
      if (options.link) {
        console.log('  Link:', options.link)
      }
    }

    // If SendGrid is not configured, only log (dev mode)
    if (!this.emailEnabled) {
      if (isDev) {
        console.log('⚠️ SendGrid not configured - email logged above')
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:234',message:'SendGrid not enabled - skipping send',data:{emailEnabled:false},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return
    }

    // Send email via SendGrid
    try {
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@skiclub.com'
      const fromName = process.env.SENDGRID_FROM_NAME || 'Ski Club Admin'

      const msg = {
        to: options.recipient,
        from: {
          email: fromEmail,
          name: fromName
        },
        subject: options.subject || 'Notification',
        text: options.message,
        html: this.buildEmailHTML(options)
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:256',message:'Calling sgMail.send',data:{to:msg.to,from:msg.from,subject:msg.subject},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      await sgMail.send(msg)
      console.log(`✅ Email sent successfully to ${options.recipient}`)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:264',message:'Email sent successfully',data:{recipient:options.recipient,success:true},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      console.error('❌ SendGrid email error:', error)
      if (error.response) {
        console.error('SendGrid error details:', error.response.body)
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notification-service.ts:274',message:'SendGrid send FAILED',data:{error:error.message,responseBody:error.response?.body,code:error.code,statusCode:error.response?.statusCode},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      throw new Error(`Failed to send email: ${error.message}`)
    }
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
