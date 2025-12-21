# SendGrid Email Setup Guide

**Status**: Integration Complete - Ready to Configure  
**Service**: Twilio SendGrid  
**Free Tier**: 100 emails/day forever  

---

## 📧 Step 1: Get SendGrid API Key

### Sign Up / Log In:
1. Go to https://sendgrid.com/
2. Log in with your Twilio account (or sign up free)
3. Free tier: 100 emails/day (no credit card required)

### Create API Key:
1. Navigate to **Settings → API Keys** in SendGrid dashboard
2. Click **"Create API Key"**
3. Name: `ski-admin-production` (or any name you prefer)
4. Permissions: 
   - **Full Access** (easiest)
   - OR **Restricted Access** with "Mail Send" permission checked
5. Click **"Create & View"**
6. **IMPORTANT**: Copy the API key immediately (you'll only see it once!)
   - Format: `SG.xxxxxxxxxxxxxxxxxxxxxxx...`

---

## 📝 Step 2: Add to Environment Variables

Add these to your `.env.local` file:

```env
# SendGrid (Twilio Email Service)
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Ski Club Admin
```

### Environment Variable Details:

- **`SENDGRID_API_KEY`**: Your SendGrid API key from Step 1
- **`SENDGRID_FROM_EMAIL`**: 
  - For **testing**: Use any email (e.g., `test@example.com`)
  - For **production**: Use your verified domain email
- **`SENDGRID_FROM_NAME`**: The name that appears as the sender

---

## 🔐 Step 3: Verify Sender Identity (For Production)

For production use, SendGrid requires sender verification.

### Single Sender Verification (Quick):
1. Go to SendGrid → **Settings → Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Fill in your details:
   - From Name: `Ski Club Admin`
   - From Email: `noreply@yourdomain.com`
   - Reply To: `support@yourdomain.com` (or your support email)
4. Click **"Create"**
5. Check your email and click verification link

### Domain Authentication (Professional - Recommended):
1. Go to SendGrid → **Settings → Sender Authentication**
2. Click **"Authenticate Your Domain"**
3. Choose your DNS provider
4. Add the provided DNS records (CNAME entries)
5. Wait for verification (can take up to 48 hours)
6. **Benefits**: Higher deliverability, no "via sendgrid.net" label

---

## ✅ Step 4: Test Email Sending

### Test with Admin Invitation:

1. Restart your Next.js dev server (to load new env vars):
   ```bash
   npm run dev
   ```

2. Create a new admin:
   - Go to **System Admin → Admins**
   - Click **"Add Admin"**
   - Enter test email (use one you can access)
   - Click **"Send Invitation"**

3. Check console logs:
   ```
   ✅ SendGrid email service initialized
   📧 Email details:
     To: test@example.com
     Subject: Admin Invitation - Your Club
     OTP Code: 123456
   ✅ Email sent successfully to test@example.com
   ```

4. **Check your email!**
   - Look in inbox (and spam folder)
   - Should receive admin invitation email
   - Contains OTP code and setup link

### Test with Parent Signup:

1. Go to `/signup`
2. Fill in the form
3. Submit
4. Check the email inbox for confirmation email

---

## 📊 Email Templates

The notification service automatically sends:

1. **Admin Invitations** - OTP code + setup link
2. **Email Verification** - OTP code for parent signups
3. **Password Resets** - OTP code for password recovery
4. **2FA Codes** - OTP for two-factor authentication (Phase 3)

All emails include:
- ✅ Professional HTML formatting
- ✅ Large, easy-to-read OTP codes
- ✅ Clear instructions
- ✅ Automatic links
- ✅ Mobile-responsive design

---

## 🐛 Troubleshooting

### "SendGrid not configured - Email logging to console only"
- ✅ **Solution**: Add `SENDGRID_API_KEY` to `.env.local` and restart dev server

### "Failed to send email: 403 Forbidden"
- ❌ **Cause**: Invalid API key or insufficient permissions
- ✅ **Solution**: 
  1. Verify API key is correct
  2. Recreate API key with "Full Access" or "Mail Send" permission
  3. Update `.env.local` and restart

### "Failed to send email: 400 Bad Request - From email is not verified"
- ❌ **Cause**: Sender email not verified (production only)
- ✅ **Solution**: Complete sender verification (Step 3)
- ⚡ **Quick fix for testing**: SendGrid allows unverified senders in development

### Emails go to spam:
- ✅ **Solution**: Complete domain authentication (Step 3)
- ✅ Add SPF/DKIM records to your DNS
- ✅ Warm up your sending domain gradually

### No emails received:
1. Check console for errors
2. Verify SendGrid dashboard → Activity Feed
3. Check spam/junk folder
4. Try different email provider (Gmail, Outlook, etc.)

---

## 💰 Pricing & Limits

### Free Tier:
- **100 emails/day** forever
- No credit card required
- Full API access
- Email templates
- Analytics

### Paid Plans (if needed):
- **Essentials**: $19.95/month - 50,000 emails/month
- **Pro**: $89.95/month - 100,000 emails/month
- **Premier**: Custom pricing

For most small-to-medium ski clubs, the **free tier** is sufficient!

---

## 📈 Monitoring

### Check Email Delivery:
1. SendGrid Dashboard → **Activity Feed**
2. See all sent emails, delivery status, bounces, clicks
3. Filter by recipient, subject, date

### Key Metrics:
- **Delivered**: Email successfully delivered
- **Opens**: Recipient opened email (if tracking enabled)
- **Clicks**: Recipient clicked links
- **Bounces**: Email rejected by recipient's server
- **Spam Reports**: Recipient marked as spam

---

## 🔒 Security Best Practices

1. **Never commit** `.env.local` to git (already in `.gitignore`)
2. **Rotate API keys** periodically
3. **Use restricted keys** in production (only "Mail Send" permission)
4. **Monitor activity** for unusual sending patterns
5. **Verify domain** for better deliverability and security

---

## 📚 Next Steps

After setting up SendGrid:

1. ✅ Test admin invitations
2. ✅ Test parent email verification (once implemented)
3. ✅ Verify sender identity for production
4. ✅ Set up domain authentication
5. ✅ Monitor email deliverability in SendGrid dashboard

---

## 🎉 You're All Set!

SendGrid is now integrated and ready to send real emails! 

- Development: Emails will be sent if SendGrid is configured, otherwise logged to console
- Production: Make sure to complete sender verification before going live

**Need help?** Check SendGrid docs: https://docs.sendgrid.com/
