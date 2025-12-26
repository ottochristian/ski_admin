# 🔐 CRITICAL: New Environment Variables Required

## **Action Required Immediately**

You must add these new environment variables to `.env.local` for the security fixes to work:

```env
# JWT Secret for Setup Tokens (REQUIRED)
# Generate a strong random string (minimum 32 characters)
# Example: openssl rand -hex 32
JWT_SECRET_KEY=your_very_long_random_secret_key_here_minimum_32_chars

# Existing variables (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=your_email
SENDGRID_FROM_NAME=Your Name
```

## **How to Generate JWT_SECRET_KEY**

### **Option 1: Using OpenSSL (Recommended)**
```bash
openssl rand -hex 32
```

### **Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### **Option 3: Online Generator**
Go to https://generate-secret.vercel.app/32 (generates 32-byte hex string)

## **Why This Is Critical**

Without `JWT_SECRET_KEY`, the new secure setup token system will not work. Setup invitation links will fail.

---

## **Database Migration Required**

Run migration 48 in Supabase SQL Editor:

```sql
-- Copy contents of migrations/48_add_token_replay_prevention.sql
-- Paste in Supabase SQL Editor
-- Click "Run"
```

This creates:
- `used_tokens` table (prevents replay attacks)
- `rate_limits` table (database-backed rate limiting)
- Helper functions for cleanup and rate limiting

---

## **After Adding Variables**

1. **Restart your dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Test admin invitation:**
   - Go to System Admin → Admins
   - Create a new admin
   - Verify the invitation email contains a token-based link

---

## **Security Improvements Implemented**

### **1. Secure Setup Tokens ✅**
- Setup links now use signed JWT tokens instead of plain email
- Tokens expire after 48 hours
- Tokens can only be used once (replay prevention)
- Tokens are validated before allowing OTP entry

### **2. Database-Backed Rate Limiting ✅**
- Rate limits persist across server restarts
- Works in multi-instance deployments
- Serverless-compatible
- Atomic operations prevent race conditions

### **3. Fixed Auto-Login ✅**
- Proper session creation after email verification
- Uses correct Supabase auth flow
- Auto-redirects to appropriate portal

---

## **Breaking Changes**

⚠️ **Old invitation links will no longer work**

If you have pending admin invitations sent before this update:
1. Delete the old admin account
2. Re-send the invitation
3. New link will use secure tokens

---

## **Need Help?**

If you encounter any issues:
1. Check console for error messages
2. Verify all environment variables are set
3. Confirm migration 48 ran successfully
4. Restart dev server

**Setup should take < 5 minutes.** Security is worth it! 🔐
