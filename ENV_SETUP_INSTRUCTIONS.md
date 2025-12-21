# Environment Variables Setup

## Your Twilio Credentials

Add these to your `.env.local` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=AC1ed6df4d0af7f3dc8fd70454603ac690
TWILIO_AUTH_TOKEN=fe8589f57e658c465b3178359b3a0885
TWILIO_PHONE_NUMBER=+13072842518

# OTP Settings
OTP_EXPIRY_MINUTES=10
OTP_ADMIN_INVITATION_EXPIRY_HOURS=24
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_PER_HOUR=5

# Security Settings
MAX_FAILED_OTP_PER_DAY=10
ACCOUNT_LOCK_DURATION_HOURS=24

# Feature Flags (Phase 1)
ENABLE_EMAIL_VERIFICATION=true
REQUIRE_PHONE_NUMBER=true
ENABLE_SMS_VERIFICATION=false
ENABLE_2FA=false
```

## How to Add

1. Open `/Users/otti/Documents/Coding_Shit/ski_admin/.env.local`
2. Add the lines above (append to the end of the file)
3. Save the file
4. Restart your dev server: `npm run dev`

## Verify It Works

After adding and restarting, the environment variables will be available in your app.

---

**Delete this file after setup!** (It contains sensitive credentials)
