import twilio from 'twilio'
import { Resend } from 'resend'

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
  private resend?: Resend
  private smsEnabled: boolean
  private emailEnabled: boolean

  constructor() {
    // Initialize Resend for email
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      try {
        this.resend = new Resend(resendApiKey)
        this.emailEnabled = true
        console.log('✅ Resend email service initialized')
      } catch (error) {
        console.error('❌ Resend initialization failed:', error)
        this.emailEnabled = false
      }
    } else {
      this.emailEnabled = false
      console.log('⚠️ Resend not configured - Email logging to console only')
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
    const message = this.buildEmailOTPMessage(code, 'email verification', firstName)
    
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
      role?: 'admin' | 'coach' // Add role parameter
    }
  ): Promise<NotificationResult> {
    const role = options.role || 'admin'
    const message = this.buildAdminInvitationMessage(code, { ...options, role })
    
    const roleLabel = role === 'coach' ? 'Coach' : 'Admin'
    
    return this.send({
      method: 'email',
      recipient: email,
      subject: `${roleLabel} Invitation - ${options.clubName}`,
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
   * Send registration confirmation email after successful payment
   */
  async sendRegistrationConfirmation(
    email: string,
    options: {
      firstName?: string
      clubName: string
      orderId: string
      totalAmount: number
      registrations: { athleteName: string; programName: string; subProgramName?: string }[]
    }
  ): Promise<NotificationResult> {
    const greeting = options.firstName ? `Hi ${options.firstName},` : 'Hello,'
    const athleteLines = options.registrations
      .map(r => `  • ${r.athleteName} — ${r.programName}${r.subProgramName ? ` (${r.subProgramName})` : ''}`)
      .join('\n')
    const total = (options.totalAmount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

    const message = `
${greeting}

Your registration is confirmed! Here's a summary of what you've enrolled in:

${athleteLines}

Total paid: ${total}
Order ID: ${options.orderId}

You'll receive further details from ${options.clubName} as the season approaches.

If you have any questions, please contact your club directly.

Thanks,
The ${options.clubName} Team
    `.trim()

    return this.send({
      method: 'email',
      recipient: email,
      subject: `Registration Confirmed — ${options.clubName}`,
      message,
      template: 'confirmation',
      link: undefined,
    })
  }

  /**
   * Send guardian invitation email
   */
  async sendGuardianInvitation(
    email: string,
    options: {
      inviterName?: string
      inviterEmail: string
      householdName?: string
      clubName: string
      invitationLink: string
    }
  ): Promise<NotificationResult> {
    const message = this.buildGuardianInvitationMessage(options)
    
    return this.send({
      method: 'email',
      recipient: email,
      subject: `Invitation to join ${options.clubName} household`,
      message,
      link: options.invitationLink,
      template: 'invitation'
    })
  }

  /**
   * Send "club request received" email to the requester
   */
  async sendClubRequestReceived(
    email: string,
    options: { firstName: string; clubName: string }
  ): Promise<NotificationResult> {
    const message = `Hi ${options.firstName},

Thanks for your interest in W110! We've received your request to set up ${options.clubName}.

We'll review your request and have your club ready within 24 hours. You'll get another email as soon as everything is set up and you can log in.

If you have any questions in the meantime, just reply to this email.

Thanks,
The W110 Team`.trim()

    return this.send({
      method: 'email',
      recipient: email,
      subject: `We received your club request — ${options.clubName}`,
      message,
    })
  }

  /**
   * Send new club request notification to the system admin (Otti)
   */
  async sendClubRequestNotification(
    adminEmail: string,
    options: {
      contactName: string
      contactEmail: string
      clubName: string
      athleteCount?: string
      notes?: string
      reviewUrl: string
    }
  ): Promise<NotificationResult> {
    const message = `New club request submitted.

Club name: ${options.clubName}
Contact: ${options.contactName} (${options.contactEmail})
Estimated athletes: ${options.athleteCount || 'Not provided'}
Notes: ${options.notes || 'None'}

Review and approve: ${options.reviewUrl}`.trim()

    return this.send({
      method: 'email',
      recipient: adminEmail,
      subject: `New club request: ${options.clubName}`,
      message,
    })
  }

  /**
   * Send "club is ready" email to the club admin after approval
   */
  async sendClubReady(
    email: string,
    options: { firstName: string; clubName: string; clubUrl: string }
  ): Promise<NotificationResult> {
    const message = `Hi ${options.firstName},

Great news — ${options.clubName} is ready on W110!

You can log in to your admin dashboard here:
${options.clubUrl}

From there you can set up your seasons, programs, and invite coaches and families.

Welcome aboard,
The W110 Team`.trim()

    return this.send({
      method: 'email',
      recipient: email,
      subject: `Your club is ready — ${options.clubName}`,
      message,
    })
  }

  /**
   * Send email via Resend
   */
  private async sendEmail(options: NotificationOptions): Promise<void> {
    const isDev = process.env.NODE_ENV === 'development'

    if (isDev) {
      console.log('📧 Email details:')
      console.log('  To:', options.recipient)
      console.log('  Subject:', options.subject)
      if (options.code) console.log('  OTP Code:', options.code)
      if (options.link) console.log('  Link:', options.link)
    }

    if (!this.emailEnabled || !this.resend) {
      if (isDev) console.log('⚠️ Resend not configured - email logged above')
      return
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@w110.io'
    const fromName = process.env.RESEND_FROM_NAME || 'W110'

    try {
      const { error } = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [options.recipient],
        subject: options.subject || 'Notification',
        text: options.message,
        html: this.buildEmailHTML(options),
      })

      if (error) {
        console.error('❌ Resend email error:', error)
        throw new Error(`Failed to send email: ${error.message}`)
      }

      console.log(`✅ Email sent successfully to ${options.recipient}`)
    } catch (error: unknown) {
      console.error('❌ Resend email error:', error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to send email: ${message}`)
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
  private buildEmailOTPMessage(code: string, purpose: string, firstName?: string): string {
    const greeting = firstName ? `Hi ${firstName},` : 'Hello,'
    
    return `
${greeting}

Your verification code for ${purpose} is:

${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Thanks,
The W110 Team
    `.trim()
  }

  /**
   * Build admin invitation message
   */
  private buildAdminInvitationMessage(
    code: string,
    options: { firstName?: string; clubName: string; setupLink: string; role?: 'admin' | 'coach' }
  ): string {
    const greeting = options.firstName ? `Hi ${options.firstName},` : 'Hello,'
    const role = options.role || 'admin'
    const roleLabel = role === 'coach' ? 'a coach' : 'an administrator'
    const actionText = role === 'coach' ? 'Start coaching' : 'Start managing your club'
    
    return `
${greeting}

You've been invited to join ${options.clubName} as ${roleLabel}!

Your verification code is: ${code}

To complete your setup:
1. Visit: ${options.setupLink}
2. Enter the code above
3. Create your password
4. ${actionText}!

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
The W110 Team
    `.trim()
  }

  /**
   * Build guardian invitation message
   */
  private buildGuardianInvitationMessage(options: {
    inviterName?: string
    inviterEmail: string
    householdName?: string
    clubName: string
    invitationLink: string
  }): string {
    const inviter = options.inviterName || options.inviterEmail
    const householdText = options.householdName 
      ? ` for the ${options.householdName} household`
      : ''
    
    return `
Hello,

${inviter} has invited you to become a secondary guardian${householdText} at ${options.clubName}.

As a secondary guardian, you'll be able to:
- View and manage all athletes in the household
- Register athletes for programs
- Sign waivers
- View billing and payment history

To accept this invitation, click the link below:
${options.invitationLink}

This invitation will expire in 7 days.

If you don't have an account yet, clicking the link will guide you through creating one.

If you didn't expect this invitation, please ignore this email.

Questions? Contact ${options.inviterEmail}

Thanks,
The ${options.clubName} Team
    `.trim()
  }

  /**
   * Build HTML email
   */
  private buildEmailHTML(options: NotificationOptions): string {
    const { code, message, subject, template } = options

    const baseStyle = `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f5; margin: 0; padding: 0; }
      .wrapper { padding: 40px 20px; }
      .container { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .header { background: #18181b; padding: 24px 32px; }
      .header-title { color: #fff; font-size: 16px; font-weight: 600; margin: 0; }
      .body { padding: 32px; }
      .code-box { background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
      .code { font-size: 36px; font-weight: 700; color: #3B82F6; letter-spacing: 8px; }
      .reg-list { background: #f9fafb; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
      .reg-item { padding: 6px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
      .reg-item:last-child { border-bottom: none; }
      .total { font-size: 18px; font-weight: 700; color: #18181b; margin: 16px 0 4px; }
      .footer { padding: 20px 32px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #9ca3af; }
      p { margin: 0 0 12px; }
      a { color: #3B82F6; }
    `

    if (template === 'confirmation') {
      // Parse registrations and total out of plain-text message for rich rendering
      const lines = message.split('\n').filter(l => l.trim())
      const greeting = lines[0] || ''
      const regLines = lines.filter(l => l.trim().startsWith('•'))
      const totalLine = lines.find(l => l.startsWith('Total paid:')) || ''
      const orderLine = lines.find(l => l.startsWith('Order ID:')) || ''
      const closing = lines.find(l => l.startsWith('You\'ll receive')) || ''

      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title><style>${baseStyle}</style></head>
<body><div class="wrapper"><div class="container">
  <div class="header"><p class="header-title">Registration Confirmed ✓</p></div>
  <div class="body">
    <p>${greeting}</p>
    <p>Your registration is confirmed. Here's what you've enrolled in:</p>
    <div class="reg-list">
      ${regLines.map(l => `<div class="reg-item">${l.replace('•', '').trim()}</div>`).join('')}
    </div>
    <p class="total">${totalLine.replace('Total paid: ', '')}</p>
    <p style="font-size:12px;color:#9ca3af;">${orderLine}</p>
    <p>${closing}</p>
  </div>
  <div class="footer"><p>This is an automated message. Please do not reply to this email.</p></div>
</div></div></body></html>`
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject || 'Notification'}</title><style>${baseStyle}</style></head>
<body><div class="wrapper"><div class="container">
  <div class="header"><p class="header-title">${subject || 'Notification'}</p></div>
  <div class="body">
    <div style="white-space: pre-line;">${message}</div>
    ${code ? `<div class="code-box"><div class="code">${code}</div></div>` : ''}
  </div>
  <div class="footer"><p>This is an automated message. Please do not reply to this email.</p></div>
</div></div></body></html>`.trim()
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
