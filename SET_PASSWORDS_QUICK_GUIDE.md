# Quick Guide: Set Passwords for Test Users

## 🎯 Goal
Set passwords for all 14 test users so you can log in and test different user flows (admin, coach, parent).

## ✅ Recommended: Use the Automated Script (Fastest)

### Step 1: Get Your Supabase Service Role Key

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **"service_role"** key (it's a secret key - click "Reveal")
3. Copy the key

### Step 2: Add to `.env.local`

Create or edit `.env.local` in your project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**⚠️ Important:** Never commit `.env.local` to git (it should already be in `.gitignore`)

### Step 3: Run the Script

```bash
node scripts/set-test-user-passwords.js
```

The script will:
- ✅ Create users if they don't exist
- ✅ Set password to `test12345` for all 14 test users
- ✅ Auto-confirm emails (so you can log in immediately)
- ✅ Show progress for each user

### Step 4: Test Login

Go to your app's login page and try logging in with:
- **Email:** `ottilieotto+gtssf+admin+a@gmail.com` (or any test user email)
- **Password:** `test12345`

---

## 📝 Alternative: Manual Method (Slower but Simple)

If you prefer to set passwords manually:

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. For each of the 14 test users:
   - Click **"Add User"** (if user doesn't exist) or click on existing user
   - **Email:** `ottilieotto+[club]+[role]+[identifier]@gmail.com`
   - **Password:** `test12345`
   - Check **"Auto Confirm User"** ✅
   - Click **"Create User"** (or **"Update User"**)

**All 14 test users:**
- ottilieotto+gtssf+admin+a@gmail.com
- ottilieotto+gtssf+admin+b@gmail.com
- ottilieotto+gtssf+coach+a@gmail.com
- ottilieotto+gtssf+coach+b@gmail.com
- ottilieotto+gtssf+parent+a@gmail.com
- ottilieotto+gtssf+parent+b@gmail.com
- ottilieotto+gtssf+parent+c@gmail.com
- ottilieotto+jackson+admin+a@gmail.com
- ottilieotto+jackson+admin+b@gmail.com
- ottilieotto+jackson+coach+a@gmail.com
- ottilieotto+jackson+coach+b@gmail.com
- ottilieotto+jackson+parent+a@gmail.com
- ottilieotto+jackson+parent+b@gmail.com
- ottilieotto+jackson+parent+c@gmail.com

---

## 🧪 Testing Different User Flows

After setting passwords, you can test:

### Admin Users (GTSSF)
- **Email:** `ottilieotto+gtssf+admin+a@gmail.com`
- **Password:** `test12345`
- **Expected:** Redirected to `/clubs/gtssf/admin`

### Coach Users (Jackson)
- **Email:** `ottilieotto+jackson+coach+a@gmail.com`
- **Password:** `test12345`
- **Expected:** Redirected to coach dashboard

### Parent Users (GTSSF)
- **Email:** `ottilieotto+gtssf+parent+a@gmail.com`
- **Password:** `test12345`
- **Expected:** Redirected to `/clubs/gtssf/parent/dashboard`

---

## 🔍 Troubleshooting

### Script Error: "Missing required environment variables"
- Make sure `.env.local` exists and has both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Get service role key from: Dashboard → Settings → API → service_role (secret)

### Script Error: "Permission denied" or Auth Error
- Make sure you're using the **service_role** key (not the anon key)
- Service role key bypasses RLS and has admin access

### Can't Log In After Setting Password
- Check that email confirmation is disabled for testing (Dashboard → Authentication → Settings → Disable "Enable email confirmations")
- Or make sure the script set `email_confirm: true` (it should)

### User Not Found
- The script will automatically create users if they don't exist
- If manual creation fails, check that the email format matches exactly

---

## 📋 Complete Test Data Setup Checklist

1. ✅ Run `GENERATE_TEST_DATA.sql` (Part 1)
2. ✅ Set passwords (this guide) - **You are here**
3. ✅ Run `GENERATE_TEST_DATA_BETWEEN.sql` (updates profile names/roles)
4. ✅ Run `GENERATE_TEST_DATA_PART2.sql` (creates households, athletes, etc.)
5. ✅ Verify with `CHECK_TEST_DATA_STATUS.sql`
6. ✅ Test login with different user roles

---

## 🚀 Quick Start Commands

```bash
# Set passwords for all test users
node scripts/set-test-user-passwords.js

# Verify users exist and have profiles
# Run this in Supabase SQL Editor:
SELECT email, first_name, last_name, role 
FROM profiles 
WHERE email LIKE 'ottilieotto+%' 
ORDER BY email;
```


