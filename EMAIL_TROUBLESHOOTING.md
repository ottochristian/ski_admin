# Email Confirmation Troubleshooting

## Issue: Not Receiving Confirmation Emails

If you're seeing "Account created! Please check your email..." but no email arrives, follow these steps:

## Step 1: Check Supabase Email Settings

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Scroll to **"Email Auth"** section
3. Verify:
   - ✅ **"Enable email confirmations"** is checked
   - ✅ **"Enable email signup"** is checked

## Step 2: Check Email Provider Configuration

### Option A: Using Supabase's Built-in Email (Default)

**Limitations:**
- Free tier: Very limited (a few emails per hour)
- Emails may be delayed
- May go to spam
- Not recommended for production

**To use:**
- No configuration needed
- Just enable email confirmations in settings

### Option B: Configure Custom SMTP (Recommended)

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider:

**Example for SendGrid:**
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [your SendGrid API key]
Sender email: noreply@yourdomain.com
Sender name: Your Club Name
```

**Example for Mailgun:**
```
Host: smtp.mailgun.org
Port: 587
Username: [your Mailgun SMTP username]
Password: [your Mailgun SMTP password]
Sender email: noreply@yourdomain.com
```

**Example for AWS SES:**
```
Host: email-smtp.us-east-1.amazonaws.com
Port: 587
Username: [your AWS SES SMTP username]
Password: [your AWS SES SMTP password]
Sender email: noreply@yourdomain.com
```

## Step 3: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Logs** → **Auth Logs**
2. Look for errors related to email sending
3. Common errors:
   - "SMTP connection failed" → Check SMTP credentials
   - "Rate limit exceeded" → Too many emails sent
   - "Invalid sender" → Check sender email configuration

## Step 4: Check Spam Folder

- Confirmation emails often go to spam
- Check your spam/junk folder
- Add the sender to your contacts if found

## Step 5: Verify Email Template

1. Go to **Authentication** → **Email Templates**
2. Check the **"Confirm signup"** template
3. Make sure it's enabled and has the confirmation URL: `{{ .ConfirmationURL }}`

## Step 6: Test Email Configuration

You can test if emails are working by:

1. **Check Supabase Logs**: Look for email sending attempts
2. **Try a different email**: Some email providers block Supabase's default sender
3. **Check SMTP test**: In SMTP settings, there's usually a "Test" button

## Step 7: Temporary Workaround for Development

If you need to test without email confirmation:

1. Go to **Authentication** → **Settings**
2. **Disable** "Enable email confirmations"
3. Users can sign up and log in immediately
4. **Re-enable** before going to production

## Step 8: Manual Email Confirmation (For Testing)

If you have access to Supabase SQL Editor, you can manually confirm a user:

```sql
-- Find the user
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Manually confirm the email (for testing only)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'your-email@example.com';
```

**⚠️ Warning**: Only use this for testing. In production, users must confirm via email.

## Common Issues

### Issue: "Email rate limit exceeded"
**Solution**: 
- Wait a few minutes
- Configure custom SMTP for higher limits
- Upgrade Supabase plan

### Issue: "SMTP authentication failed"
**Solution**:
- Double-check SMTP credentials
- Verify SMTP provider allows connections from Supabase
- Check if 2FA is required (some providers need app passwords)

### Issue: "Emails going to spam"
**Solution**:
- Configure SPF/DKIM records for your domain
- Use a custom domain for sender email
- Configure custom SMTP with proper domain

## Next Steps

1. **For Development**: Disable email confirmation temporarily
2. **For Production**: Set up proper SMTP (SendGrid, Mailgun, or AWS SES)
3. **Test thoroughly**: Verify emails are sent and received
4. **Monitor logs**: Keep an eye on email sending success rates
