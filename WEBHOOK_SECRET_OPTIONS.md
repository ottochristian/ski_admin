# Getting Stripe Webhook Secret - Options

Since you don't have Stripe CLI installed yet, here are your options:

## Option 1: Install Stripe CLI (Best for Development) ⭐

### Install Homebrew first:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Then install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
```

### Login and forward webhooks:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will output a webhook secret like `whsec_xxxxx` - add it to `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

## Option 2: Install Stripe CLI Without Homebrew

### Download directly:
1. Go to: https://github.com/stripe/stripe-cli/releases/latest
2. Download `stripe_X.X.X_macos_x86_64.tar.gz` (or `stripe_X.X.X_macos_arm64.tar.gz` for Apple Silicon)
3. Extract and move to your PATH:
   ```bash
   tar -xzf stripe_X.X.X_macos_x86_64.tar.gz
   sudo mv stripe /usr/local/bin/
   ```

### Then use it:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Option 3: Use Dummy Webhook Secret (Temporary)

**For local development only** - you can use a dummy value temporarily:

```env
STRIPE_WEBHOOK_SECRET=whsec_dummy_for_local_dev
```

**⚠️ Note:** This won't work for actual webhook verification, but it will:
- ✅ Allow your build to pass
- ✅ Let you develop/test other features
- ❌ Won't verify webhook signatures (not safe for production)

**Important:** Replace with real webhook secret before testing payments!

---

## Option 4: Set Up Webhook in Stripe Dashboard (For Production)

For production, you'll need to:

1. **Deploy your app first** (or use a tunnel like ngrok for local testing)
2. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
3. Click **"Add endpoint"**
4. Enter endpoint URL: `https://your-domain.com/api/webhooks/stripe`
5. Select event: `checkout.session.completed`
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Add to your hosting platform's environment variables

---

## 🚀 Quick Start Recommendation

**Right now, to unblock your build:**

1. **Add dummy webhook secret** to `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_dummy_for_dev
   ```

2. **Run build** to verify it passes:
   ```bash
   npm run build
   ```

3. **Later, install Stripe CLI** when you're ready to test webhooks:
   ```bash
   # Install Homebrew
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe
   
   # Get real webhook secret
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Update `.env.local`** with the real `whsec_...` value

---

## 📝 Complete .env.local Example

```env
# Supabase (you already have these)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe (add these)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_dummy_for_dev  # Replace with real one later

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=debug
```

---

## ✅ Verification

After adding the webhook secret (even dummy), run:
```bash
npm run build
```

Should complete successfully!


