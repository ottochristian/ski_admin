# Admin Invite Email Setup

## Problem
When you invite a new admin via System Admin → Create Admin, the invitation is created successfully in Supabase, but **no email is sent**. The invited user cannot complete onboarding.

## Root Cause
Supabase's email service is not configured. By default, Supabase has very limited email sending capabilities (a few emails per hour on free tier, often delayed or blocked).

## Solution: Configure SMTP Email Provider

You need to configure a custom SMTP provider in Supabase to reliably send invitation emails.

### Step 1: Choose an Email Provider

**Recommended options:**
- **Resend** (easiest, generous free tier) - https://resend.com
- **SendGrid** (popular, 100 emails/day free) - https://sendgrid.com
- **Mailgun** (reliable, 5000 emails/month free trial) - https://mailgun.com
- **AWS SES** (cheapest at scale) - https://aws.amazon.com/ses

### Step 2: Get SMTP Credentials

#### For Resend (Recommended):
1. Sign up at https://resend.com
2. Verify your domain (or use Resend's test domain for development)
3. Go to **API Keys** → **Create API Key**
4. Copy the API key (starts with `re_`)

#### For SendGrid:
1. Sign up at https://sendgrid.com
2. Go to **Settings** → **API Keys** → **Create API Key**
3. Give it "Full Access" or at least "Mail Send" permissions
4. Copy the API key

### Step 3: Configure Supabase SMTP Settings

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Settings** → **SMTP Settings**
3. Fill in the details based on your provider:

#### Resend Configuration:
```
Host: smtp.resend.com
Port: 587 (or 465 for SSL)
Username: resend
Password: [your Resend API key starting with re_]
Sender email: onboarding@yourdomain.com (or noreply@resend.dev for testing)
Sender name: Your Club Name
Enable TLS: Yes
```

#### SendGrid Configuration:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [your SendGrid API key starting with SG.]
Sender email: noreply@yourdomain.com
Sender name: Your Club Name
Enable TLS: Yes
```

#### Mailgun Configuration:
```
Host: smtp.mailgun.org
Port: 587
Username: [your Mailgun SMTP username from domain settings]
Password: [your Mailgun SMTP password]
Sender email: noreply@yourdomain.com
Sender name: Your Club Name
Enable TLS: Yes
```

### Step 4: Configure Allowed Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add these to **Redirect URLs**:
   ```
   http://localhost:3000/setup-password
   https://yourdomain.com/setup-password
   ```

### Step 5: Customize Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Select **Invite user** template
3. Customize the message (the default is fine, but you can personalize it)

Example template:
```html
<h2>You've been invited!</h2>
<p>You have been invited to join {{ .SiteURL }} as a club administrator.</p>
<p>Click the link below to set your password and access the admin portal:</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
<p>This link expires in 24 hours.</p>
```

### Step 6: Test the Setup

1. Go to **System Admin** → **Club Admins**
2. Click **Create Admin**
3. Enter a test email (use your own email)
4. Select a club
5. Click **Send Invitation**
6. Check your email inbox (and spam folder)
7. Click the invitation link
8. You should be redirected to `/setup-password` where you can set a password

### Step 7: Verify in Supabase Logs

After sending an invitation, check:
1. **Supabase Dashboard** → **Logs** → **Auth Logs**
2. Look for entries like:
   - ✅ `user.invited` - User was invited successfully
   - ✅ `email.sent` - Email was sent successfully
   - ❌ `email.failed` - Email sending failed (check SMTP config)

## Troubleshooting

### "User created but no email received"
- **Check spam folder** - Invitation emails often go to spam
- **Verify SMTP credentials** - Wrong password is the most common issue
- **Check sender domain** - Some providers require domain verification
- **Check rate limits** - Free tiers have sending limits

### "Invalid SMTP credentials"
- Double-check username and password (no extra spaces)
- For SendGrid, username must be exactly `apikey` (not your actual username)
- For Resend, username must be exactly `resend`

### "Emails going to spam"
- Set up **SPF, DKIM, and DMARC** records for your domain
- Use a verified sender domain (not @gmail.com or @yahoo.com)
- Most email providers provide instructions for domain verification

### "Rate limit exceeded"
- Supabase's default email service has very low limits
- Switch to a custom SMTP provider (see Step 2)
- SendGrid free tier: 100 emails/day
- Resend free tier: 3,000 emails/month
- Mailgun free trial: 5,000 emails/month

## Current Setup

Your app is configured to redirect invited users to:
- **Development**: `http://localhost:3000/setup-password`
- **Production**: `${NEXT_PUBLIC_APP_URL}/setup-password`

Make sure `NEXT_PUBLIC_APP_URL` is set in your production environment variables.

## Testing Without Email (Temporary Workaround)

If you need to test immediately without setting up email:

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find the invited user (email will show as "invited" status)
3. Click on the user
4. Click **Send password reset email** OR manually set a password
5. User can now log in

But for production, you **must** set up SMTP properly.

## Code Implementation

The invite functionality is in:
- **API Route**: `/app/api/system-admin/invite-admin/route.ts`
- **UI Component**: `/components/create-club-admin-dialog.tsx`

Both are working correctly. The issue is purely Supabase email configuration.
