# Twilio Phone Number Setup Guide

## Step 1: Log into Twilio Console

Go to: https://console.twilio.com

## Step 2: Purchase a Phone Number

### 2.1 Navigate to Phone Numbers
1. In the left sidebar, click **Phone Numbers** → **Manage** → **Buy a number**
2. Or go directly to: https://console.twilio.com/us1/develop/phone-numbers/manage/search

### 2.2 Select Number Type

**Recommended:** SMS-capable number in your country

**For USA:**
- Country: United States (+1)
- Capabilities needed: ✅ SMS (required)
- Optional: ✅ Voice (for future IVR/phone support)
- Optional: ✅ MMS (multimedia messages - images, not needed now)

**Cost:**
- One-time setup: $0
- Monthly rental: ~$1.15/month for US number
- International: Varies by country ($1-5/month)

### 2.3 Filter Options

**Search filters:**
- [ ] Number contains: (optional - search for specific digits like "555")
- [ ] Area code: (optional - choose local area code)
- [x] SMS: **Required** ✅
- [ ] Voice: Optional (recommended for future)
- [ ] MMS: Optional (not needed)

**Recommendations:**
- **Local number:** Choose area code near your club location (builds trust)
- **Toll-free:** Only if you want 1-800/1-888 number (more expensive, ~$2/month)
- **SMS-capable:** Required ✅

### 2.4 Purchase the Number

1. Click **Search** to see available numbers
2. Review the list of available numbers
3. Click **Buy** next to your chosen number
4. Confirm purchase
5. Number is instantly active! ✅

## Step 3: Get Your Credentials

### 3.1 Account SID and Auth Token

1. Go to **Twilio Console Dashboard**: https://console.twilio.com
2. Scroll to **Account Info** section
3. Copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "show" to reveal, starts with random string)

### 3.2 Your Phone Number

1. Go to **Phone Numbers** → **Manage** → **Active numbers**
2. Copy your purchased number (format: `+15555551234`)

## Step 4: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555551234

# Replace with your actual values from Twilio console
```

**Important:**
- Phone number must include country code and `+` prefix
- Example US number: `+15551234567`
- Example UK number: `+447911123456`

## Step 5: Test Your Setup (Quick Test)

### 5.1 Send Test SMS via Twilio Console

1. Go to **Messaging** → **Try it out** → **Send an SMS**
2. Or: https://console.twilio.com/us1/develop/sms/try-it-out/send-an-sms
3. Fill in:
   - **From:** Your Twilio number (dropdown)
   - **To:** Your personal phone number (for testing)
   - **Message:** "Hello from Twilio! This is a test."
4. Click **Send**
5. Check your phone - you should receive the SMS within seconds!

**If it works:** ✅ Your Twilio account is set up correctly!

**If it doesn't work:**
- Check that your phone number is SMS-capable
- Verify your "To" number is in correct format (+15555551234)
- Check Twilio logs: **Monitor** → **Logs** → **Messaging**

## Step 6: Verify Trial Account Limitations

### Trial Account Restrictions:
- ⚠️ Can only send to **verified phone numbers**
- ⚠️ Messages include "Sent from your Twilio trial account" prefix
- ⚠️ Limited number of messages

### To Remove Trial Restrictions:
1. Go to **Console** → **Upgrade**
2. Add payment method (credit card)
3. Upgrade account (no minimum commitment)
4. **Cost:** Pay-as-you-go, ~$0.0079 per SMS in US

**Recommendation:** Upgrade before production launch to:
- Remove trial message prefix
- Send to any phone number (not just verified ones)
- Scale without restrictions

## Step 7: Add Verified Phone Numbers (Trial Only)

If you're staying on trial account for testing:

1. Go to **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Or: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
3. Click **Add a new number**
4. Enter your phone number (for testing)
5. Choose verification method: **SMS** or **Voice call**
6. Enter the code you receive
7. Number is now verified! ✅

You can send SMS to this verified number during trial.

## Step 8: Set Up Messaging Service (Optional but Recommended)

**Benefits:**
- Better deliverability
- Support for multiple phone numbers (future scaling)
- Better analytics

**Setup:**
1. Go to **Messaging** → **Services**
2. Click **Create Messaging Service**
3. Name: "Ski Admin Notifications"
4. Use case: "Notify my users"
5. Click **Create**
6. Add your phone number to the sender pool
7. Copy the **Messaging Service SID** (starts with `MG...`)

**Update .env.local:**
```env
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This is optional for Phase 1, but recommended for production.

## Step 9: Configure Webhooks (Optional)

Webhooks allow you to receive delivery status updates:

1. Go to **Phone Numbers** → **Manage** → **Active numbers**
2. Click on your purchased number
3. Scroll to **Messaging** section
4. Configure **A MESSAGE COMES IN**:
   - Webhook URL: `https://yourdomain.com/api/webhooks/twilio/incoming`
   - HTTP Method: POST
5. Configure **STATUS CALLBACK URL**:
   - Webhook URL: `https://yourdomain.com/api/webhooks/twilio/status`
   - HTTP Method: POST

**Use Cases:**
- Track delivery status (sent, delivered, failed)
- Receive incoming SMS (for two-way communication)
- Log errors

Not needed for Phase 1, but useful for production.

## Step 10: Monitor Usage and Costs

### View Usage:
1. Go to **Monitor** → **Usage**
2. Or: https://console.twilio.com/us1/monitor/usage

**Track:**
- SMS sent (count and cost)
- Failed messages
- Average cost per message

### Set Usage Alerts:
1. Go to **Monitor** → **Alerts**
2. Create alert: "Notify me when spending exceeds $X"
3. Useful to avoid surprise bills

**Recommendation:** Set alert at $20/month initially

## Environment Variables Summary

After completing setup, your `.env.local` should have:

```env
# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555551234

# Optional: Messaging Service (for better deliverability)
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OTP Settings
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_PER_HOUR=5

# Resend (Email) - to be configured later
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## Troubleshooting

### Error: "The 'To' phone number is not verified"
- **Cause:** Trial account restriction
- **Fix:** Verify the phone number or upgrade account

### Error: "The message could not be sent"
- **Cause:** Invalid phone number format
- **Fix:** Use E.164 format (+15555551234)

### Error: "Authentication failed"
- **Cause:** Wrong Account SID or Auth Token
- **Fix:** Double-check credentials from Twilio console

### SMS not received
- **Check 1:** Verify number is SMS-capable
- **Check 2:** Check Twilio logs (Monitor → Logs)
- **Check 3:** Check phone number format (+1 for US)
- **Check 4:** Try different phone number

### "Sent from your Twilio trial account" prefix
- **Cause:** Trial account
- **Fix:** Upgrade to paid account (removes prefix)

## Cost Breakdown

### Initial Setup:
- Account creation: **Free** ✅
- Phone number purchase: **$0 one-time**

### Ongoing Costs:
- Phone number rental: **$1.15/month**
- SMS (USA/Canada): **$0.0079 per message**
- SMS (International): Varies (typically $0.02-0.10)

### Example Monthly Costs:

**Low Usage (500 SMS/month):**
- Phone rental: $1.15
- SMS: 500 × $0.0079 = $3.95
- **Total: ~$5/month** ✅

**Medium Usage (1,000 SMS/month):**
- Phone rental: $1.15
- SMS: 1,000 × $0.0079 = $7.90
- **Total: ~$9/month** ✅

**High Usage (5,000 SMS/month):**
- Phone rental: $1.15
- SMS: 5,000 × $0.0079 = $39.50
- **Total: ~$41/month**

**Your expected usage (Phase 1):** ~$5-10/month ✅

## Next Steps

After purchasing your phone number:

1. ✅ Add credentials to `.env.local`
2. ✅ Test SMS sending via Twilio console
3. ✅ Restart your dev server (`npm run dev`)
4. ⏭️ Install Twilio npm package: `npm install twilio`
5. ⏭️ Implement notification service (I'll do this)
6. ⏭️ Test OTP delivery in development

## Security Best Practices

1. **Never commit `.env.local`** - Already in `.gitignore` ✅
2. **Rotate Auth Token** - If exposed, regenerate immediately
3. **Use environment variables** - Never hardcode credentials
4. **Monitor usage** - Set up billing alerts
5. **Restrict API access** - Use Twilio API keys for production (optional)

## Support

If you have issues:
- Twilio Docs: https://www.twilio.com/docs
- Twilio Support: https://support.twilio.com
- Check Twilio logs: Console → Monitor → Logs

---

**Ready to purchase?** Follow Steps 1-4 above, then come back and tell me your phone number is set up!
