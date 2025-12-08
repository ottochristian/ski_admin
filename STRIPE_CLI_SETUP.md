# Stripe CLI Setup for Local Development

## Quick Start

### 1. Login to Stripe CLI (if not already logged in)
```bash
stripe login
```
This will open your browser to authenticate.

### 2. Start Webhook Forwarding

In a **separate terminal window** (keep your `npm run dev` running in another terminal):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Important:** Keep this terminal running while you're testing payments!

### 3. Copy the Webhook Secret

When you run `stripe listen`, you'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

Copy that secret (the `whsec_...` part).

### 4. Add to Your .env.local

Add or update this line in your `.env.local` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Note:** The webhook secret changes each time you restart `stripe listen`, so you'll need to update it.

### 5. Restart Your Dev Server

After updating `.env.local`, restart your Next.js dev server:
```bash
npm run dev
```

### 6. Test a Payment

1. Make sure both terminals are running:
   - Terminal 1: `npm run dev`
   - Terminal 2: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

2. Complete a test payment in your app

3. Watch Terminal 2 - you should see:
   ```
   --> checkout.session.completed [evt_xxx]
   <-- [200] POST http://localhost:3000/api/webhooks/stripe [evt_xxx]
   ```

4. Check your database - payment should now be recorded!

---

## Troubleshooting

### Webhook secret mismatch
- If you restart `stripe listen`, get the new secret and update `.env.local`
- Restart your dev server after updating

### No events appearing
- Make sure `stripe listen` is running
- Check that the endpoint URL is correct
- Verify `STRIPE_WEBHOOK_SECRET` matches what Stripe CLI shows

### Payment succeeded but webhook didn't process
- Check Terminal 2 for errors
- Check your server logs
- Verify the webhook secret is correct

---

## What Stripe CLI Does

When you run `stripe listen`:
- It connects to your Stripe account
- Listens for webhook events
- Forwards them to your local `localhost:3000/api/webhooks/stripe` endpoint
- Shows you all events in real-time

This way, Stripe can "send" webhooks to your local machine even though it's not publicly accessible!

---

## For Production Later

When you deploy to production, you'll configure the webhook endpoint in Stripe Dashboard with your production URL (e.g., `https://your-domain.com/api/webhooks/stripe`), but for now, Stripe CLI is the way to go for local development.