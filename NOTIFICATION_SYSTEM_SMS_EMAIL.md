# Unified Notification System (Email + SMS)

## Overview

This guide shows how to implement a notification system that can send both emails and SMS messages for admin invitations, password resets, registration confirmations, and other notifications.

## Architecture

```
┌─────────────────────────────────────────┐
│        Application Layer                │
│  (Admin Invite, Registration, etc.)     │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│    Notification Service (Abstraction)   │
│  - sendInvitation(method, recipient)    │
│  - sendPasswordReset(method, recipient) │
│  - sendConfirmation(method, recipient)  │
└─────────────┬───────────────────────────┘
              │
      ┌───────┴───────┐
      ▼               ▼
┌──────────┐    ┌──────────┐
│  Email   │    │   SMS    │
│ Provider │    │ Provider │
│ (Resend) │    │ (Twilio) │
└──────────┘    └──────────┘
```

## SMS Provider Options

### 1. **Twilio** (Recommended - Most Popular)

**Pros:**
- Most reliable SMS delivery worldwide
- Excellent documentation and support
- Wide country coverage (180+ countries)
- Generous free trial ($15 credit)
- WhatsApp integration available

**Pricing:**
- US/Canada: $0.0079/SMS
- International: Varies by country
- Phone number rental: $1.15/month

**Setup:**
```bash
npm install twilio
```

**Code Example:**
```typescript
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

await client.messages.create({
  body: 'Your invitation link: https://...',
  from: process.env.TWILIO_PHONE_NUMBER,
  to: '+15555551234'
})
```

### 2. **AWS SNS** (Best for AWS Users)

**Pros:**
- Very cheap ($0.00645/SMS in US)
- Great if you're already using AWS
- High volume discounts

**Cons:**
- More complex setup
- Requires AWS account and IAM configuration

### 3. **Vonage (formerly Nexmo)**

**Pros:**
- Good international coverage
- Competitive pricing
- Free trial available

**Pricing:**
- US: $0.0075/SMS
- International: Varies

### 4. **Plivo**

**Pros:**
- Cheaper than Twilio
- Good for high-volume sending
- International coverage

**Cons:**
- Less widely used
- Smaller community

## Recommended Stack

**For most cases:**
- **Email**: Resend (easy setup, generous free tier)
- **SMS**: Twilio (reliable, great docs, free trial)

## Implementation Plan

### Step 1: Install Dependencies

```bash
npm install twilio
npm install @react-email/components  # Optional: for beautiful email templates
```

### Step 2: Add Environment Variables

```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555551234

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx
```

### Step 3: Create Notification Service

Create `/lib/services/notification-service.ts`:

```typescript
import twilio from 'twilio'

// Email types
type EmailProvider = 'resend' | 'supabase'
type SMSProvider = 'twilio' | 'aws-sns'

// Notification methods
type NotificationMethod = 'email' | 'sms' | 'both'

interface NotificationOptions {
  method: NotificationMethod
  recipient: string  // email or phone number
  phoneNumber?: string  // if method is 'both'
  subject?: string
  message: string
  link?: string
  template?: 'invitation' | 'password-reset' | 'confirmation'
}

class NotificationService {
  private twilioClient?: ReturnType<typeof twilio>

  constructor() {
    // Initialize Twilio only if credentials are provided
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )
    }
  }

  /**
   * Send a notification via email, SMS, or both
   */
  async send(options: NotificationOptions): Promise<{
    success: boolean
    emailSent?: boolean
    smsSent?: boolean
    error?: string
  }> {
    const results = {
      success: true,
      emailSent: false,
      smsSent: false,
      error: undefined as string | undefined
    }

    try {
      // Send email
      if (options.method === 'email' || options.method === 'both') {
        await this.sendEmail(options)
        results.emailSent = true
      }

      // Send SMS
      if (options.method === 'sms' || options.method === 'both') {
        const phone = options.method === 'both' 
          ? options.phoneNumber! 
          : options.recipient
        
        await this.sendSMS({
          to: phone,
          message: options.message,
          link: options.link
        })
        results.smsSent = true
      }

      return results
    } catch (error) {
      console.error('Notification error:', error)
      return {
        success: false,
        emailSent: results.emailSent,
        smsSent: results.smsSent,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send admin invitation
   */
  async sendAdminInvitation(options: {
    method: NotificationMethod
    email: string
    phoneNumber?: string
    firstName?: string
    invitationLink: string
    clubName: string
  }) {
    const message = `Hi${options.firstName ? ' ' + options.firstName : ''}! You've been invited to join ${options.clubName} as an administrator. Click here to set your password: ${options.invitationLink}`

    return this.send({
      method: options.method,
      recipient: options.email,
      phoneNumber: options.phoneNumber,
      subject: `Admin Invitation - ${options.clubName}`,
      message,
      link: options.invitationLink,
      template: 'invitation'
    })
  }

  /**
   * Send password reset
   */
  async sendPasswordReset(options: {
    method: NotificationMethod
    email: string
    phoneNumber?: string
    resetLink: string
  }) {
    const message = `Reset your password by clicking this link: ${options.resetLink} (expires in 1 hour)`

    return this.send({
      method: options.method,
      recipient: options.email,
      phoneNumber: options.phoneNumber,
      subject: 'Password Reset Request',
      message,
      link: options.resetLink,
      template: 'password-reset'
    })
  }

  /**
   * Send registration confirmation
   */
  async sendRegistrationConfirmation(options: {
    method: NotificationMethod
    email: string
    phoneNumber?: string
    athleteName: string
    programName: string
    amount: number
  }) {
    const message = `Registration confirmed for ${options.athleteName} in ${options.programName}. Amount paid: $${options.amount.toFixed(2)}`

    return this.send({
      method: options.method,
      recipient: options.email,
      phoneNumber: options.phoneNumber,
      subject: 'Registration Confirmation',
      message,
      template: 'confirmation'
    })
  }

  /**
   * Send email via Resend or Supabase
   */
  private async sendEmail(options: NotificationOptions) {
    // For now, we'll use Supabase's email (already configured)
    // In the future, you can switch to Resend by implementing this method
    
    // If using Resend:
    // const { Resend } = await import('resend')
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'onboarding@yourdomain.com',
    //   to: options.recipient,
    //   subject: options.subject || 'Notification',
    //   html: `<p>${options.message}</p>${options.link ? `<p><a href="${options.link}">Click here</a></p>` : ''}`
    // })
    
    // For now, Supabase handles email via inviteUserByEmail
    // This method is a placeholder for future email-only notifications
    console.log('Email sent via Supabase:', options.recipient)
  }

  /**
   * Send SMS via Twilio
   */
  private async sendSMS(options: {
    to: string
    message: string
    link?: string
  }) {
    if (!this.twilioClient) {
      throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN')
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('TWILIO_PHONE_NUMBER is not configured')
    }

    // Format phone number (must include country code)
    const formattedPhone = options.to.startsWith('+') 
      ? options.to 
      : `+1${options.to}`  // Assume US if no country code

    // Truncate message if too long (SMS limit is 160 chars)
    let fullMessage = options.message
    if (options.link && fullMessage.length + options.link.length > 160) {
      fullMessage = `${options.message.substring(0, 140)}... ${options.link}`
    } else if (options.link) {
      fullMessage = `${options.message} ${options.link}`
    }

    await this.twilioClient.messages.create({
      body: fullMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    })

    console.log('SMS sent to:', formattedPhone)
  }
}

export const notificationService = new NotificationService()
```

### Step 4: Update Admin Invitation API

Update `/app/api/system-admin/invite-admin/route.ts` to support SMS:

```typescript
// Add to the request body type
const { email, firstName, lastName, clubId, phoneNumber, notificationMethod } = body

// Validate
if (!email || !clubId) {
  return NextResponse.json(
    { error: 'Email and clubId are required' },
    { status: 400 }
  )
}

// If SMS is selected, require phone number
if ((notificationMethod === 'sms' || notificationMethod === 'both') && !phoneNumber) {
  return NextResponse.json(
    { error: 'Phone number is required for SMS notifications' },
    { status: 400 }
  )
}

// After creating the user invitation, send notification
if (inviteData.user && notificationMethod !== 'email') {
  // Send SMS or both
  const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL}/setup-password`
  
  await notificationService.sendAdminInvitation({
    method: notificationMethod || 'email',
    email,
    phoneNumber,
    firstName,
    invitationLink,
    clubName: 'Your Club Name'  // Get from database
  })
}
```

### Step 5: Update UI to Support SMS

Update `/components/create-club-admin-dialog.tsx`:

```typescript
// Add state
const [notificationMethod, setNotificationMethod] = useState<'email' | 'sms' | 'both'>('email')
const [phoneNumber, setPhoneNumber] = useState('')

// In the form:
<div className="space-y-2">
  <Label>Notification Method</Label>
  <RadioGroup value={notificationMethod} onValueChange={(value: any) => setNotificationMethod(value)}>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="email" id="email" />
      <Label htmlFor="email">Email only</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="sms" id="sms" />
      <Label htmlFor="sms">SMS only</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="both" id="both" />
      <Label htmlFor="both">Email + SMS</Label>
    </div>
  </RadioGroup>
</div>

{(notificationMethod === 'sms' || notificationMethod === 'both') && (
  <div className="space-y-2">
    <Label htmlFor="phone">Phone Number *</Label>
    <Input
      id="phone"
      type="tel"
      placeholder="+1 555-555-5555"
      value={phoneNumber}
      onChange={(e) => setPhoneNumber(e.target.value)}
    />
    <p className="text-xs text-muted-foreground">
      Include country code (e.g., +1 for US)
    </p>
  </div>
)}
```

## Cost Analysis

### For 1000 admin invitations per month:

**Email only (Resend):**
- Cost: $0 (within free tier of 3,000/month)

**SMS only (Twilio):**
- Cost: $7.90 (1000 × $0.0079)

**Both:**
- Cost: $7.90

### For 10,000 notifications per month:

**Email only:**
- Cost: ~$10/month (Resend paid tier)

**SMS only:**
- Cost: $79/month

**Both:**
- Cost: ~$89/month

## Setup Priority

**Immediate (Required):**
1. ✅ Configure Supabase SMTP with Resend (for emails to work at all)

**Phase 2 (Optional):**
2. Add Twilio for SMS notifications
3. Give users choice of notification method
4. Store preference in database

**Phase 3 (Advanced):**
5. Two-factor authentication via SMS
6. WhatsApp integration (via Twilio)
7. Notification preferences per user
8. Delivery tracking and analytics

## Next Steps

1. **First**: Set up Resend SMTP in Supabase (see ADMIN_INVITE_EMAIL_SETUP.md)
2. **Test**: Verify emails work reliably
3. **Then**: If you need SMS, sign up for Twilio and implement the notification service
4. **Optional**: Add user preference for notification method

Would you like me to implement the full notification service with SMS support now, or focus on getting email working first?
