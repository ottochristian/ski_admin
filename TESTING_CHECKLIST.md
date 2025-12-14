# Testing Checklist - Production Readiness

## ✅ What We've Completed

1. ✅ Webhook events table migration
2. ✅ Environment variable validation
3. ✅ Stripe keys configured
4. ✅ Health check endpoint
5. ✅ Security headers
6. ✅ Improved middleware
7. ✅ API authentication helpers
8. ✅ Webhook idempotency

---

## 🧪 Testing Steps

### 1. Verify Build Passes

```bash
npm run build
```

**Expected:** Build completes successfully with no errors about missing environment variables.

**If it fails:** Check error message and verify all required env vars are in `.env.local`.

---

### 2. Test Health Check Endpoint

**Start your dev server:**
```bash
npm run dev
```

**In another terminal, test the health endpoint:**
```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "timestamp": "2025-01-XX...",
  "status": "healthy",
  "checks": {
    "api": "healthy",
    "database": "healthy"
  }
}
```

**If database is unhealthy:** Check your Supabase connection settings.

---

### 3. Test Application Starts

**Start dev server:**
```bash
npm run dev
```

**Open in browser:**
```
http://localhost:3000
```

**Expected:**
- ✅ Home page loads (landing page or redirects if logged in)
- ✅ No console errors
- ✅ Can navigate to `/login`

---

### 4. Test Authentication Flow

**Test login:**
1. Go to `http://localhost:3000/login`
2. Enter valid credentials
3. Should redirect to appropriate dashboard based on role

**Test middleware protection:**
1. Log out
2. Try to access `http://localhost:3000/admin`
3. Should redirect to `/login?redirect=%2Fadmin`

**Expected:** Protected routes require authentication.

---

### 5. Test Stripe Integration (Optional - Requires Full Setup)

**Prerequisites:**
- Must have real webhook secret (not dummy)
- Stripe CLI installed and running
- Test payment flow set up

**Steps:**

1. **Start Stripe webhook forwarding:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

2. **Create a test order** through your app

3. **Complete checkout** - should redirect to Stripe test page

4. **Use test card:** `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code

5. **Verify webhook processes:**
   - Check Stripe CLI terminal for webhook events
   - Check your app - order should be marked as paid
   - Check database - payment record should be created

**Note:** This requires a full registration flow setup. Skip for now if not ready.

---

### 6. Test Error Handling

**Test invalid API request:**
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** Returns 401 Unauthorized (requires authentication)

**Test health endpoint:**
```bash
curl http://localhost:3000/api/health
```

**Expected:** Returns 200 with health status

---

### 7. Verify Security Headers

**In browser DevTools:**
1. Open `http://localhost:3000`
2. Open DevTools → Network tab
3. Reload page
4. Click on any request → Headers tab
5. Check Response Headers for:
   - `X-Frame-Options: SAMEORIGIN`
   - `X-Content-Type-Options: nosniff`
   - `Strict-Transport-Security: ...`
   - `X-XSS-Protection: 1; mode=block`

**Expected:** All security headers present.

---

### 8. Test Environment Validation

**Temporarily remove a required env var:**
```bash
# Backup .env.local first!
cp .env.local .env.local.backup

# Remove a variable (temporarily)
# Edit .env.local and comment out STRIPE_SECRET_KEY
```

**Try to build:**
```bash
npm run build
```

**Expected:** Build fails with clear error about missing variable.

**Restore .env.local:**
```bash
mv .env.local.backup .env.local
```

---

## 📊 Quick Test Script

Save this as `test-setup.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Production Readiness Setup"
echo ""

echo "1. Testing build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ Build passes"
else
  echo "   ❌ Build fails - check errors above"
  exit 1
fi

echo ""
echo "2. Testing health endpoint..."
# Start server in background
npm run dev > /dev/null 2>&1 &
SERVER_PID=$!
sleep 5

HEALTH=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH" | grep -q "healthy"; then
  echo "   ✅ Health endpoint works"
else
  echo "   ❌ Health endpoint failed"
  kill $SERVER_PID
  exit 1
fi

echo ""
echo "3. Testing security headers..."
HEADERS=$(curl -s -I http://localhost:3000 | grep -i "x-frame-options\|x-content-type-options")
if [ -n "$HEADERS" ]; then
  echo "   ✅ Security headers present"
else
  echo "   ⚠️  Security headers not found"
fi

# Cleanup
kill $SERVER_PID

echo ""
echo "✅ Basic tests complete!"
```

**Run it:**
```bash
chmod +x test-setup.sh
./test-setup.sh
```

---

## ✅ Next Steps After Testing

Once basic tests pass:

1. **Add pagination** to registrations page (high priority)
2. **Migrate login/signup** to new Supabase client
3. **Add database indexes** for performance
4. **Set up monitoring** (Sentry, etc.)
5. **Load testing** (simulate 50 clubs, 500 kids)

See `NEXT_STEPS_PRIORITIZED.md` for detailed roadmap.

---

## 🐛 Common Issues

### Build fails with missing env vars
- Check `.env.local` exists
- Verify all required vars are set
- Restart terminal/IDE after adding vars

### Health endpoint shows database unhealthy
- Check Supabase connection
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check network/firewall

### Webhooks not working
- Need real webhook secret (not dummy)
- Stripe CLI must be running
- Endpoint URL must match

### Security headers not showing
- Check `next.config.ts` has headers config
- Restart dev server
- Clear browser cache

---

**Ready to test?** Start with step 1 (build) and work through the list!



