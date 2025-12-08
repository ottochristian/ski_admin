# Stripe Keys Setup Guide

## 📋 What You Have vs What's Needed

### ✅ What You Have:
- **Publishable Key** (starts with `pk_test_...` or `pk_live_...`)
- **Secret Key** (starts with `sk_test_...` or `sk_live_...`)

### ⚠️ What's Still Needed:
- **Webhook Secret** (starts with `whsec_...`) - Get this from Stripe Dashboard after setting up webhook

---

## 🔑 Where to Add Your Keys

### 1. Add to `.env.local` File

Open your `.env.local` file and add:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional (for future client-side Stripe usage)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

**Important:** Replace the placeholder values with your actual keys!

---

## 📝 Step-by-Step Setup

### Step 1: Add Secret Key (Required)

1. Open `.env.local` in your project root
2. Add this line:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. Replace `sk_test_...` with your actual secret key from Stripe Dashboard

**Used in:**
- `/app/api/checkout/route.ts` - Creating checkout sessions
- `/app/api/webhooks/stripe/route.ts` - Verifying webhooks

### Step 2: Add Publishable Key (Optional for now)

1. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

**Note:** Currently not used in the code, but good to have for future Stripe.js integration on the client side.

### Step 3: Get Webhook Secret (Required)

The webhook secret is different from your API keys. You get it after setting up a webhook endpoint:

#### For Local Development:

1. **Install Stripe CLI** (if you haven't):
   ```bash
   brew install stripe/stripe-cli/stripe  # macOS
   # or download from https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe CLI:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   
   This will output a webhook signing secret like:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxx
   ```

4. **Add to `.env.local`:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

#### For Production:

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter your endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed` (required)
   - Others as needed
5. Click **"Add endpoint"**
6. Copy the **"Signing secret"** (starts with `whsec_...`)
7. Add to your hosting platform's environment variables (Vercel, Netlify, etc.)

---

## 🧪 Verify Setup

After adding the keys, verify they're working:

### 1. Test Build
```bash
npm run build
```
Should complete successfully (no missing env var errors).

### 2. Test Checkout Flow
1. Start dev server: `npm run dev`
2. Go through registration flow
3. Attempt checkout
4. Should redirect to Stripe Checkout page

### 3. Test Webhook (Development)
```bash
# In one terminal, start your server
npm run dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger a test webhook
stripe trigger checkout.session.completed
```

---

## 📁 Complete `.env.local` Example

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=debug
```

---

## 🔒 Security Notes

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Use test keys** for development (`sk_test_...`, `pk_test_...`)
3. **Use live keys** only in production environment
4. **Webhook secret** is different per endpoint (local vs production)
5. **Rotate keys** if they're ever exposed

---

## 🆘 Troubleshooting

### "Missing required environment variables: STRIPE_SECRET_KEY"
- Make sure you added `STRIPE_SECRET_KEY` to `.env.local`
- Restart your dev server after adding env vars

### "Missing required environment variables: STRIPE_WEBHOOK_SECRET"
- For development: Use Stripe CLI to get webhook secret
- For production: Get from Stripe Dashboard → Webhooks

### "Invalid signature" in webhook
- Make sure `STRIPE_WEBHOOK_SECRET` matches the endpoint
- Webhook secret is different for local vs production
- Restart server after changing webhook secret

### Webhooks not working in production
1. Verify webhook endpoint URL is correct
2. Check that webhook secret matches in your hosting platform
3. Ensure endpoint is accessible (not blocked by firewall)
4. Check Stripe Dashboard → Webhooks → Logs for errors

---

## 📚 Resources

- [Stripe API Keys](https://stripe.com/docs/keys)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Docs](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks Locally](https://stripe.com/docs/stripe-cli/webhooks)

---

## ✅ Quick Checklist

- [ ] Added `STRIPE_SECRET_KEY` to `.env.local`
- [ ] Added `STRIPE_WEBHOOK_SECRET` to `.env.local` (from Stripe CLI or Dashboard)
- [ ] Added `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env.local` (optional)
- [ ] Restarted dev server
- [ ] Verified build passes: `npm run build`
- [ ] Tested checkout flow
- [ ] Set up production webhook endpoint (when deploying)

