# Webhook Setup Guide

## The Problem
Stripe payments are succeeding, but your app isn't being notified because webhooks aren't being received.

## Why Webhooks Aren't Working Locally

When running locally (`localhost:3000`), Stripe can't directly send webhooks to your machine. You need to use **Stripe CLI** to forward webhooks from Stripe's servers to your local app.

## Setup for Local Development

### 1. Install Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Or download from:** https://stripe.com/docs/stripe-cli

### 2. Login to Stripe CLI
```bash
stripe login
```
This will open your browser to authenticate with your Stripe account.

### 3. Forward Webhooks to Local Server

In a **separate terminal window**, run:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Important:** Keep this terminal running while testing payments!

You should see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxx (^C to quit)
```

### 4. Set the Webhook Secret

Copy the webhook signing secret (`whsec_xxxxx`) from the CLI output and add it to your `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 5. Test a Payment

1. Make sure Stripe CLI is running (`stripe listen`)
2. Complete a test payment in your app
3. Watch the CLI terminal - you should see webhook events being forwarded:
   ```
   --> checkout.session.completed [evt_xxx]
   <-- [200] POST http://localhost:3000/api/webhooks/stripe [evt_xxx]
   ```

## Production Setup

For production (when deployed):

### 1. Configure Webhook Endpoint in Stripe Dashboard

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter your production URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed` ✅
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to your production environment variables as `STRIPE_WEBHOOK_SECRET`

### 2. Verify Webhook is Working

1. Go to **Webhooks** → Click your endpoint
2. Check **"Recent events"** tab
3. You should see events coming in after payments

## Troubleshooting

### Webhook events not appearing in database

1. **Check Stripe CLI is running** (for local dev)
2. **Check webhook secret** matches what Stripe CLI shows
3. **Check server logs** for webhook errors
4. **Verify webhook endpoint** is accessible

### Payment succeeded but order still unpaid

1. **Check `webhook_events` table** - is the event there?
2. **Check `webhook_events.processed`** - is it `true` or `false`?
3. **Check `webhook_events.error_message`** - any errors?
4. If event failed, you can manually fix using `FIX_CURRENT_PAYMENT.sql`

### Manual Webhook Retry

If a webhook failed:
1. Go to **Stripe Dashboard** → **Webhooks** → **Events**
2. Find the `checkout.session.completed` event
3. Click **"Send test webhook"** or **"Replay event"**

## Testing Checklist

- [ ] Stripe CLI installed and logged in
- [ ] `stripe listen` running in separate terminal
- [ ] Webhook secret in `.env.local` matches CLI output
- [ ] Test payment completes successfully
- [ ] Webhook events appear in CLI terminal
- [ ] Payment record created in `payments` table
- [ ] Order status updated to `paid`
- [ ] Registration status updated to `confirmed`

## Quick Reference

**Local Development:**
```bash
# Terminal 1: Run your app
npm run dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Check webhook status:**
```sql
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;
```

**Check payments:**
```sql
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
```

