# Testing Payment Flow - Step by Step Guide

## Prerequisites

1. ✅ Stripe keys added to `.env.local`
2. ✅ Stripe webhook secret (from Stripe CLI or Dashboard)
3. ✅ Dev server running
4. ✅ Test Stripe account set up

---

## Option 1: Test with Stripe CLI (Recommended for Development)

### Step 1: Install Stripe CLI (if not installed)

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Or download manually:**
- https://github.com/stripe/stripe-cli/releases/latest

### Step 2: Login to Stripe CLI
```bash
stripe login
```

### Step 3: Forward Webhooks to Your Local Server

In a **separate terminal** (keep dev server running):
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will output:
```
> Ready! Your webhook signing secret is whsec_xxxxx (^C to quit)
```

### Step 4: Update `.env.local`

Add the webhook secret from step 3:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

**Important:** Restart your dev server after updating `.env.local`

---

## Option 2: Test with Stripe Dashboard (For Production-like Testing)

### Step 1: Get Your Public URL

Use a tunnel service to expose your local server:
- **ngrok**: `ngrok http 3000`
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:3000`
- **Localtunnel**: `npx localtunnel --port 3000`

### Step 2: Create Webhook Endpoint in Stripe

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter your public URL: `https://your-tunnel-url.ngrok.io/api/webhooks/stripe`
4. Select event: `checkout.session.completed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_...`)

### Step 3: Update `.env.local`

```env
STRIPE_WEBHOOK_SECRET=whsec_your_secret_from_dashboard
```

---

## Testing the Complete Flow

### Test Data Setup

1. **Login as a parent user**
   - Or create a test parent account

2. **Ensure you have:**
   - At least one athlete in your household
   - At least one active program/sub-program in the current season
   - Club is set up properly

### Step-by-Step Test

#### 1. Browse Programs
```
http://localhost:3000/clubs/[clubSlug]/parent/programs
```
- ✅ Should show available programs
- ✅ Select an athlete
- ✅ Add programs to cart

#### 2. View Cart
```
http://localhost:3000/clubs/[clubSlug]/parent/cart
```
- ✅ Should show selected programs
- ✅ Shows total amount
- ✅ "Checkout" button available

#### 3. Click Checkout
- ✅ Should create order in database (status: 'unpaid')
- ✅ Should create registrations (status: 'pending')
- ✅ Should redirect to Stripe Checkout page

#### 4. Complete Payment on Stripe

**Use Stripe test card:**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

- ✅ Enter test card details
- ✅ Click "Pay"
- ✅ Should redirect to success page

#### 5. Verify Webhook Processing

**Check Stripe CLI terminal** (if using Option 1):
- ✅ Should see webhook event received
- ✅ Should see "Event received: checkout.session.completed"

**Or check Stripe Dashboard** → **Webhooks** → **Logs**:
- ✅ Should see successful webhook delivery

#### 6. Verify Database Changes

Check in Supabase or via your app:

**Orders table:**
```sql
SELECT id, status, total_amount, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 1;
```
- ✅ Status should be `'paid'`

**Payments table:**
```sql
SELECT * FROM payments 
ORDER BY created_at DESC 
LIMIT 1;
```
- ✅ Should have a new payment record
- ✅ Status should be `'succeeded'`
- ✅ Should have `stripe_checkout_session_id`

**Registrations table:**
```sql
SELECT id, status, created_at 
FROM registrations 
ORDER BY created_at DESC 
LIMIT 5;
```
- ✅ Status should be `'confirmed'` (changed from 'pending')

**Webhook events table:**
```sql
SELECT stripe_event_id, event_type, processed, processed_at 
FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 1;
```
- ✅ Should have the event recorded
- ✅ `processed` should be `true`
- ✅ Should have `processed_at` timestamp

#### 7. Verify Billing Page

```
http://localhost:3000/clubs/[clubSlug]/parent/billing
```
- ✅ Should show the new order
- ✅ Order status: "Paid"
- ✅ Payment details visible
- ✅ Registrations confirmed

---

## Troubleshooting

### Issue: Checkout redirects but Stripe shows error

**Check:**
- ✅ Stripe secret key is correct in `.env.local`
- ✅ Using test keys (`sk_test_...`) not live keys
- ✅ Stripe account is in test mode

### Issue: Webhook not processing

**Check:**
- ✅ Webhook secret is correct in `.env.local`
- ✅ Stripe CLI is running (if using Option 1)
- ✅ Webhook endpoint URL is correct (if using Option 2)
- ✅ Restart dev server after changing env vars

**Check logs:**
```bash
# Check browser console for errors
# Check terminal where dev server is running
# Check Stripe Dashboard → Webhooks → Logs
```

### Issue: Order created but not marked as paid

**Check:**
- ✅ Webhook endpoint is accessible
- ✅ Webhook signature verification is passing
- ✅ Check `webhook_events` table - is event recorded?
- ✅ Check server logs for webhook processing errors

### Issue: "Invalid signature" error

**Possible causes:**
- Wrong webhook secret
- Webhook secret mismatch between Stripe and your app
- Request body was modified

**Solution:**
- Verify webhook secret matches exactly
- If using Stripe CLI, make sure it's still running
- Check that `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the one from Stripe

---

## Quick Test Checklist

- [ ] Stripe keys in `.env.local`
- [ ] Webhook secret in `.env.local`
- [ ] Dev server running
- [ ] Stripe CLI running (if using) OR webhook endpoint configured in Dashboard
- [ ] Logged in as parent user
- [ ] Have at least one athlete
- [ ] Have at least one active program
- [ ] Add program to cart
- [ ] Click checkout
- [ ] Complete payment with test card
- [ ] Verify redirect to billing page
- [ ] Check database - order marked as paid
- [ ] Check database - registrations confirmed
- [ ] Check webhook events table - event processed

---

## Testing Different Scenarios

### Test 1: Successful Payment
- ✅ Use card: `4242 4242 4242 4242`
- ✅ Should complete successfully

### Test 2: Payment Decline
- ✅ Use card: `4000 0000 0000 0002`
- ✅ Should show decline message
- ✅ Order should remain `'unpaid'`
- ✅ Registrations should remain `'pending'`

### Test 3: Webhook Retry (Idempotency)
- ✅ Send duplicate webhook manually:
  ```bash
  stripe trigger checkout.session.completed
  ```
- ✅ Check `webhook_events` table
- ✅ Should see duplicate event marked as processed
- ✅ Order should not be charged twice

### Test 4: Multiple Items in Cart
- ✅ Add multiple programs to cart
- ✅ Complete checkout
- ✅ Verify all registrations are confirmed
- ✅ Verify order total is correct

---

## Debugging Commands

### Check Recent Orders
```sql
SELECT o.id, o.status, o.total_amount, o.created_at,
       h.primary_email as household_email
FROM orders o
JOIN households h ON h.id = o.household_id
ORDER BY o.created_at DESC
LIMIT 10;
```

### Check Recent Webhook Events
```sql
SELECT stripe_event_id, event_type, processed, 
       processed_at, error_message, created_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

### Check Recent Payments
```sql
SELECT p.id, p.amount, p.status, p.method,
       p.stripe_checkout_session_id, p.created_at,
       o.id as order_id, o.status as order_status
FROM payments p
JOIN orders o ON o.id = p.order_id
ORDER BY p.created_at DESC
LIMIT 10;
```

### Check Recent Registrations
```sql
SELECT r.id, r.status, r.created_at,
       a.first_name || ' ' || a.last_name as athlete_name,
       sp.name as program_name
FROM registrations r
JOIN athletes a ON a.id = r.athlete_id
JOIN sub_programs sp ON sp.id = r.sub_program_id
ORDER BY r.created_at DESC
LIMIT 10;
```

---

## Next Steps After Testing

Once payment flow is verified:
1. ✅ Test with different card scenarios
2. ✅ Verify idempotency works
3. ✅ Test error handling
4. ✅ Review webhook logs for any issues
5. ✅ Document any edge cases found

---

**Ready to test?** Follow the steps above and let me know if you encounter any issues!


