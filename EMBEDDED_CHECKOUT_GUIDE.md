# Embedded Checkout Implementation Guide

## Overview
This guide outlines what's needed to embed Stripe checkout within your page instead of redirecting to Stripe's hosted checkout page.

## Current Architecture (Checkout Sessions)
- ✅ Redirects to Stripe's hosted page
- ✅ Stripe handles PCI compliance
- ✅ Simple to implement
- ❌ Less control over UI/UX
- ❌ Requires redirect away from your site

## Embedded Architecture (Stripe Elements)
- ✅ Payment form embedded in your React page
- ✅ Full control over UI/UX
- ✅ Seamless user experience
- ⚠️ More complex implementation
- ⚠️ Need to handle PCI compliance (but Stripe Elements handles it for you)

---

## Implementation Changes

### 1. Install Dependencies

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2. Create Payment Intent API Route

**New file:** `app/api/payments/create-intent/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { user } = authResult
    const { orderId, amount } = await request.json()

    // Verify order ownership (same as checkout route)
    const supabase = createSupabaseAdminClient()
    const { data: order } = await supabase
      .from('orders')
      .select('*, households(id)')
      .eq('id', orderId)
      .single()

    // Create Payment Intent (instead of Checkout Session)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        order_id: orderId,
        user_id: user.id,
      },
      // Optional: Save payment method for future use
      setup_future_usage: 'off_session',
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
```

### 3. Update Webhook Handler

**Modify:** `app/api/webhooks/stripe/route.ts`

Change from handling `checkout.session.completed` to `payment_intent.succeeded`:

```typescript
// Replace this event handler:
if (event.type === 'checkout.session.completed') {
  // ... current logic
}

// With this:
if (event.type === 'payment_intent.succeeded') {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const orderId = paymentIntent.metadata?.order_id

  // Same order update logic as before
  // Update order status, registrations, etc.
}
```

### 4. Create Embedded Checkout Component

**New file:** `components/embedded-checkout.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface EmbeddedCheckoutProps {
  orderId: string
  amount: number
  clubSlug: string
  onSuccess: () => void
  onError: (error: string) => void
}

function CheckoutForm({ orderId, amount, onSuccess, onError }: EmbeddedCheckoutProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    // Create payment intent when component mounts
    fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount }),
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret))
  }, [orderId, amount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setProcessing(true)

    const cardElement = elements.getElement(CardElement)

    if (!cardElement) {
      onError('Card element not found')
      setProcessing(false)
      return
    }

    // Confirm payment with Stripe
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        // Optional: Add billing details
        billing_details: {
          // Add user details here
        },
      },
    })

    if (error) {
      onError(error.message || 'Payment failed')
      setProcessing(false)
    } else if (paymentIntent?.status === 'succeeded') {
      // Payment succeeded! Webhook will handle order update
      // But we can show success immediately
      onSuccess()
    }
  }

  if (!clientSecret) {
    return <div>Loading payment form...</div>
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border rounded-lg p-4">
        <CardElement options={cardElementOptions} />
      </div>
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full"
      >
        {processing ? 'Processing...' : `Pay $${(amount / 100).toFixed(2)}`}
      </Button>
    </form>
  )
}

export function EmbeddedCheckout(props: EmbeddedCheckoutProps) {
  const options: StripeElementsOptions = {
    // You'll get clientSecret from the API
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0570de',
      },
    },
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm {...props} />
    </Elements>
  )
}
```

### 5. Update Cart Page

**Modify:** `app/clubs/[clubSlug]/parent/cart/page.tsx`

Replace the checkout redirect with embedded checkout:

```typescript
// Instead of redirecting:
// window.location.href = checkoutUrl

// Show embedded checkout modal/page:
const [showCheckout, setShowCheckout] = useState(false)
const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null)

// After creating order:
setCheckoutOrderId(order.id)
setShowCheckout(true)

// In your JSX:
{showCheckout && checkoutOrderId && (
  <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Complete Payment</DialogTitle>
      </DialogHeader>
      <EmbeddedCheckout
        orderId={checkoutOrderId}
        amount={total}
        clubSlug={clubSlug}
        onSuccess={() => {
          setShowCheckout(false)
          clearCart()
          router.push(`/clubs/${clubSlug}/parent/billing?success=true`)
        }}
        onError={(error) => {
          setError(error)
        }}
      />
    </DialogContent>
  </Dialog>
)}
```

---

## Key Differences

### Current Flow (Checkout Sessions):
1. User clicks "Checkout"
2. Redirect to Stripe hosted page
3. User pays on Stripe's page
4. Redirect back to success/cancel URL
5. Webhook handles order confirmation

### New Flow (Payment Intents):
1. User clicks "Checkout"
2. Create Payment Intent (server-side)
3. Show embedded payment form (your page)
4. User pays without leaving your site
5. Webhook handles order confirmation

---

## Additional Considerations

### Security
- ✅ Stripe Elements handles PCI compliance automatically
- ✅ Never store full card details
- ✅ All sensitive data goes directly to Stripe

### Error Handling
- Handle payment failures gracefully
- Show clear error messages
- Allow retry without losing cart state

### Payment Methods
- Currently: Cards only
- Could add: Apple Pay, Google Pay, etc. (Stripe handles this)

### Testing
- Use Stripe test cards: `4242 4242 4242 4242`
- Test various failure scenarios
- Test webhook delivery

### Loading States
- Show loading while creating Payment Intent
- Show processing state during payment
- Handle slow network connections

---

## Estimated Effort

- **Backend changes:** 2-3 hours
  - Create Payment Intent API route
  - Update webhook handler
  - Test payment flow

- **Frontend changes:** 4-6 hours
  - Install and configure Stripe Elements
  - Create embedded checkout component
  - Update cart page UI
  - Handle success/error states
  - Testing

- **Total:** ~6-9 hours of development + testing

---

## Pros & Cons

### Pros:
- ✅ Better user experience (no redirect)
- ✅ More control over UI/UX
- ✅ Can show loading states, progress indicators
- ✅ Better mobile experience

### Cons:
- ⚠️ More code to maintain
- ⚠️ Need to handle more edge cases
- ⚠️ Slightly more complex error handling
- ⚠️ Need to test more thoroughly

---

## Recommendation

**Current approach (Checkout Sessions) is fine for now** because:
- It's simpler and more maintainable
- Stripe handles all edge cases
- PCI compliance is fully handled by Stripe
- Less code = fewer bugs

**Consider embedded checkout if:**
- You want a more seamless user experience
- You need custom branding/styling
- You want to collect additional info during checkout
- You have the time to implement and test thoroughly

---

## Next Steps (If Implementing)

1. Create Payment Intent API route
2. Update webhook to handle `payment_intent.succeeded`
3. Create embedded checkout component
4. Update cart page to use embedded checkout
5. Test thoroughly with Stripe test cards
6. Update success/error handling
7. Add loading states and better UX

