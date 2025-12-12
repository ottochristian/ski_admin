# Stripe Webhook Events Configuration

## Required Events (Enable These)

### 1. `checkout.session.completed` ✅ **REQUIRED**
- **When it fires:** After a customer successfully completes a checkout session
- **What it does in your app:**
  - Updates order status from `unpaid` → `paid`
  - Creates payment record in `payments` table
  - Updates registration status from `pending` → `confirmed`
  - Sets `payment_status` to `paid` and `amount_paid` on registrations
- **Status:** ✅ **Currently implemented**

**This is the ONLY event you need for basic payment flow!**

---

## Optional Events (Consider Adding)

### 2. `payment_intent.succeeded` (Alternative)
- **When it fires:** When a payment intent succeeds (if using Payment Intents directly)
- **Use case:** Only needed if you switch to embedded checkout with Payment Intents
- **Status:** ❌ Not currently implemented (you're using Checkout Sessions)

### 3. `payment_intent.payment_failed` (Recommended)
- **When it fires:** When a payment attempt fails
- **What it could do:**
  - Log failed payment attempts
  - Notify admin/user of failure
  - Keep order as `unpaid`
- **Status:** ❌ Not currently implemented

### 4. `charge.refunded` (Recommended for Production)
- **When it fires:** When a payment is refunded
- **What it should do:**
  - Update order status (maybe add `refunded` status)
  - Update registration status
  - Create refund record
- **Status:** ❌ Not currently implemented

### 5. `checkout.session.async_payment_succeeded` (For delayed payments)
- **When it fires:** When an async payment (like bank transfer) succeeds later
- **Use case:** Only if you accept bank transfers or other delayed payment methods
- **Status:** ❌ Not needed for card payments

### 6. `checkout.session.async_payment_failed` (For delayed payments)
- **When it fires:** When an async payment fails
- **Use case:** Only if you accept delayed payment methods
- **Status:** ❌ Not needed for card payments

---

## Events You DON'T Need (For Now)

- `invoice.*` - Only for subscriptions/billing (you're using one-time payments)
- `customer.*` - Optional, only if you're storing customer info
- `subscription.*` - You're not using subscriptions
- `product.*` / `price.*` - Only if managing products via Stripe

---

## Recommended Configuration

### For Local Development:
**Minimum (current setup):**
- ✅ `checkout.session.completed`

### For Production:
**Recommended:**
- ✅ `checkout.session.completed` - **REQUIRED**
- ✅ `payment_intent.payment_failed` - Track failed payments
- ✅ `charge.refunded` - Handle refunds

**Nice to have:**
- `invoice.payment_succeeded` - If you add subscriptions later
- `customer.created` / `customer.updated` - If storing customer data

---

## How to Enable Events in Stripe

### Via Stripe CLI (Local):
When you run `stripe listen`, it automatically listens to all events. Your code filters which ones to process.

### Via Stripe Dashboard (Production):

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click your webhook endpoint (or create one)
3. In the **"Select events to listen to"** section, choose:
   - **"Select events"** (recommended) or **"Receive all events"**
4. Check the boxes for:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.payment_failed` (optional)
   - ✅ `charge.refunded` (optional)
5. Click **"Add events"**
6. Copy the **Webhook signing secret** to your environment variables

---

## Current Implementation Status

Your webhook handler (`app/api/webhooks/stripe/route.ts`) currently:
- ✅ Handles `checkout.session.completed`
- ✅ Records all events in `webhook_events` table (for debugging)
- ✅ Implements idempotency (won't process same event twice)
- ❌ Doesn't handle failed payments
- ❌ Doesn't handle refunds

---

## Quick Setup Command

For **local development**, you're already set! Just run:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

For **production**, enable these events in Stripe Dashboard:
1. `checkout.session.completed` ← **This is the main one you need!**

That's it! Your current setup handles the payment flow with just this one event.

---

## Future Enhancements

If you want to add support for failed payments and refunds, you'd need to:

1. **Add `payment_intent.payment_failed` handler:**
   ```typescript
   if (event.type === 'payment_intent.payment_failed') {
     // Log failure, notify user, etc.
   }
   ```

2. **Add `charge.refunded` handler:**
   ```typescript
   if (event.type === 'charge.refunded') {
     // Update order/registration status, create refund record
   }
   ```

But for now, **just enable `checkout.session.completed`** - that's all you need! 🎉
