# Verify Supabase Email Configuration

## Quick Diagnostic Checklist

If you can't receive emails even when sent from Supabase UI → Authentication → Users → "Send confirmation email", then the email service is **not configured**.

### Step 1: Check Email Confirmation Settings

1. Go to **Supabase Dashboard**
2. Navigate to **Authentication** → **Settings**
3. Scroll to **Email Auth** section
4. Check these settings:

```
✅ Enable email signup: Should be ON
✅ Enable email confirmations: Should be ON (or OFF if you don't want confirmations)
✅ Secure email change: Recommended ON
```

### Step 2: Check SMTP Configuration Status

1. Still in **Authentication** → **Settings**
2. Scroll to **SMTP Settings** section
3. Check if SMTP is configured:

**If you see:**
- `Not configured` or `Using Supabase's email service` → **This is your problem**
- Custom SMTP host filled in → SMTP is configured (but may have wrong credentials)

### Step 3: Understand Supabase's Built-in Email

**Supabase's built-in email service:**
- ⚠️ **Very limited** - Only works for development/testing
- ⚠️ **Not reliable** - Emails often don't arrive or are severely delayed
- ⚠️ **No production support** - Supabase recommends custom SMTP for production
- ⚠️ **Rate limited** - Very few emails per hour on free tier

**Common issues:**
- Emails go to spam (check spam folder)
- Emails are delayed by 5-30 minutes
- Emails don't arrive at all
- Gmail/Yahoo may block them entirely

### Step 4: Check Auth Logs for Errors

1. Go to **Supabase Dashboard** → **Logs** → **Auth Logs**
2. Filter to recent time (last hour)
3. Look for entries related to your test email
4. Common error messages:
   - `Email rate limit exceeded` - Too many emails sent
   - `SMTP error` - SMTP credentials are wrong
   - `Email provider error` - External provider issue
   - No log entry = email service not triggered at all

### Step 5: Test Email Pattern

Your email `ottilieotto+jackson+admin+d@gmail.com` is perfectly valid:
- Gmail supports `+` aliasing
- Length is fine (Gmail supports up to 64 characters before @)
- Not an issue with the email format

### The Real Problem

If Supabase UI can't send emails, **you must configure custom SMTP**. Supabase's built-in service is essentially non-functional for most production use cases.

## Recommended Solution: Configure SMTP NOW

You need to set up custom SMTP before you can reliably send ANY emails (invitations, password resets, confirmations).

**Fastest option - Resend (5 minutes to set up):**

1. Sign up at https://resend.com (free, no credit card needed)
2. Go to **API Keys** → **Create API Key**
3. Copy the API key (starts with `re_`)
4. In Supabase:
   - Go to **Authentication** → **Settings** → **SMTP Settings**
   - Host: `smtp.resend.com`
   - Port: `587`
   - Username: `resend`
   - Password: [paste your `re_...` API key]
   - Sender email: `onboarding@resend.dev` (for testing) or your verified domain
   - Enable TLS: ✅ Yes
5. Click **Save**
6. Try sending the invitation again

**Once SMTP is configured, all your emails (invitations, password resets, confirmations) will work immediately.**

## Testing After Configuration

After setting up SMTP:

1. Go to **Supabase UI** → **Authentication** → **Users**
2. Find the invited user
3. Click the **...** menu → **Send password reset email**
4. Email should arrive within seconds
5. If it doesn't, check **Logs** → **Auth Logs** for errors

## Why Supabase Built-in Email Fails

Supabase uses AWS SES under the hood for their "built-in" service, but:
- They don't verify your sender domain
- They use shared IPs (often blacklisted)
- Rate limits are very aggressive
- Email providers (Gmail, Outlook) often reject or spam-filter them
- No delivery guarantees

**Bottom line: You MUST use custom SMTP for production (and even testing).**
