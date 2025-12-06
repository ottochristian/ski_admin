# Registration Flow Implementation

## ✅ What's Been Built

### 1. Parent Portal Structure
- **Layout**: `/clubs/[clubSlug]/parent/layout.tsx`
  - Navigation with cart indicator
  - Cart provider for state management
  - Parent authentication check

### 2. Parent Authentication Hook
- **`lib/use-parent-club.ts`**
  - Checks authentication
  - Verifies parent role
  - Loads household and athletes
  - Falls back to `families` table if `households` doesn't exist yet

### 3. Cart System
- **`lib/cart-context.tsx`**
  - In-memory cart state
  - Add/remove items
  - Calculate totals
  - Prevents duplicate registrations

### 4. Browse Programs Page
- **`/clubs/[clubSlug]/parent/programs`**
  - Lists all active programs/sub-programs for current season
  - Shows pricing
  - Select athlete → Add to cart
  - Season-aware filtering

### 5. Cart Page
- **`/clubs/[clubSlug]/parent/cart`**
  - Shows all cart items
  - Order summary with total
  - Checkout button
  - Creates registrations (pending) and order on checkout
  - Redirects to Stripe

### 6. Checkout API
- **`/api/checkout`**
  - Creates Stripe checkout session
  - Links to order
  - Returns checkout URL

### 7. Stripe Webhook
- **`/api/webhooks/stripe`**
  - Handles `checkout.session.completed` event
  - Updates order status to 'paid'
  - Creates payment record
  - Confirms registrations (pending → confirmed)

### 8. Billing Page
- **`/clubs/[clubSlug]/parent/billing`**
  - Shows order history for current season
  - Payment status
  - Order details with line items
  - Success message after payment

### 9. Dashboard & Athletes Pages
- **Dashboard**: Overview with quick actions
- **Athletes**: List household athletes

## 🔧 Required Environment Variables

Add these to your `.env.local` and Vercel:

```bash
# Stripe (required for checkout)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Get from Stripe Dashboard → Webhooks
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Or your production URL

# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 📋 Setup Steps

### 1. Stripe Setup
1. Create Stripe account (or use existing)
2. Get API keys from Dashboard → Developers → API keys
3. Add `STRIPE_SECRET_KEY` to environment variables
4. Create webhook endpoint in Stripe Dashboard:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`
5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 2. Database Setup
Ensure these tables exist (from migrations):
- ✅ `households` (or `families` as fallback)
- ✅ `household_guardians` (or `families.profile_id` as fallback)
- ✅ `athletes` (with `household_id` or `family_id`)
- ✅ `orders`
- ✅ `order_items`
- ✅ `payments`
- ✅ `registrations` (with `season_id`, `club_id`, `price`)

### 3. Test the Flow
1. Log in as a parent user
2. Navigate to `/clubs/[clubSlug]/parent/programs`
3. Select an athlete
4. Add programs to cart
5. Go to cart and checkout
6. Complete Stripe payment (use test card: 4242 4242 4242 4242)
7. Verify:
   - Order created with status 'paid'
   - Payment record created
   - Registrations confirmed
   - Billing page shows order

## 🔄 Registration Flow

```
1. Parent browses programs
   ↓
2. Selects athlete + sub-program → Add to Cart
   ↓
3. Cart page → Review items
   ↓
4. Click "Checkout"
   ↓
5. System creates:
   - Registrations (status: 'pending')
   - Order (status: 'unpaid')
   - Order items
   ↓
6. Redirect to Stripe Checkout
   ↓
7. Parent pays via Stripe
   ↓
8. Stripe webhook fires
   ↓
9. System updates:
   - Order → 'paid'
   - Creates payment record
   - Registrations → 'confirmed'
   ↓
10. Parent redirected to billing page (success)
```

## 🐛 Known Issues / TODO

1. **Household Migration**: Currently falls back to `families` table. Should migrate fully to `households` + `household_guardians`.

2. **Error Handling**: Add better error messages for:
   - Stripe API failures
   - Duplicate registration attempts
   - Missing athlete/household

3. **Cart Persistence**: Cart is in-memory. Consider:
   - localStorage backup
   - DB-backed cart for logged-in users

4. **Waitlist Support**: Not yet implemented. Should check capacity and offer waitlist option.

5. **Discount Codes**: Not yet implemented.

6. **Email Notifications**: Should send confirmation email after successful payment (via Resend).

## 🧪 Testing Checklist

- [ ] Parent can browse programs
- [ ] Can add items to cart
- [ ] Cart shows correct totals
- [ ] Checkout creates order and registrations
- [ ] Stripe checkout redirects correctly
- [ ] Webhook updates order/payment status
- [ ] Registrations are confirmed after payment
- [ ] Billing page shows orders
- [ ] Duplicate registration prevention works
- [ ] Season filtering works correctly
