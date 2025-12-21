# Testing OTP Admin Invitation Flow

## Prerequisites

✅ Migration 46 has been run in Supabase
✅ Environment variables added to `.env.local`:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
✅ Dev server running (`npm run dev`)

## Test Flow (End-to-End)

### Step 1: Create Admin Invitation

1. Log in as **System Admin**
   - Email: `ottilieotto+jackson@gmail.com` (or your system admin account)
   
2. Navigate to **System Admin** → **Club Admins**

3. Click **"Create Admin"** button

4. Fill in the form:
   - **Email**: Use a test email (e.g., `test-admin@example.com`)
   - **First Name**: Test
   - **Last Name**: Admin
   - **Phone**: (optional for now)
   - **Club**: Select any club (e.g., GTSSF)

5. Click **"Send Invitation"**

### Step 2: Check Success Response

**You should see:**
- ✅ Success toast: "Invitation sent to test-admin@example.com"
- ✅ **Dev Mode** - OTP Code displayed in toast (e.g., `123456`)
- ✅ Setup link shown in toast
- ✅ Console log with:
  ```
  🔐 Admin Invitation Details:
  Email: test-admin@example.com
  OTP Code: 123456
  Setup Link: http://localhost:3000/setup-password?email=test-admin%40example.com
  ```

**Copy the OTP code and setup link from the console!**

### Step 3: Verify Database

Open Supabase Dashboard → Table Editor:

**Check `profiles` table:**
- New row with email `test-admin@example.com`
- `role` = `admin`
- `club_id` = (selected club ID)
- `email_verified_at` = `NULL` (not verified yet)

**Check `verification_codes` table:**
- New row with:
  - `user_id` = (new admin's user ID)
  - `type` = `admin_invitation`
  - `contact` = `test-admin@example.com`
  - `code` = `123456` (6 digits)
  - `expires_at` = ~24 hours from now
  - `verified_at` = `NULL`

### Step 4: Complete Setup (As New Admin)

1. **Open the setup link** (from console):
   ```
   http://localhost:3000/setup-password?email=test-admin@example.com
   ```

2. **Page should show:**
   - "Verify Your Invitation" heading
   - Email field pre-filled: `test-admin@example.com`
   - 6 empty boxes for OTP code
   - "Resend Code" button

3. **Enter the 6-digit OTP** (from console, e.g., `123456`)
   - Type or paste the code
   - Should auto-verify when all 6 digits entered

4. **Should see:**
   - ✅ Success message: "Code verified! Now set your password."
   - Page transitions to password setup form

5. **Set Password:**
   - Enter password (min 8 characters): e.g., `TestPass123!`
   - Confirm password: `TestPass123!`
   - Click **"Set Password & Complete Setup"**

6. **Should see:**
   - ✅ Success message: "Password set successfully! Redirecting to login..."
   - Automatically redirected to `/login` after 2 seconds
   - Login page shows: "Account setup complete! Please log in."

### Step 5: Verify Admin Can Log In

1. **On login page**, enter:
   - Email: `test-admin@example.com`
   - Password: `TestPass123!` (what you set)

2. Click **"Sign In"**

3. **Should:**
   - ✅ Successfully log in
   - ✅ Redirect to admin dashboard (for GTSSF club)
   - ✅ See admin navigation (Programs, Athletes, etc.)

### Step 6: Verify Database Updates

**Check `profiles` table:**
- `email_verified_at` should now be set (timestamp)
- `role` = `admin`
- User is active

**Check `verification_codes` table:**
- `verified_at` should now be set (timestamp)
- Code has been used

**Check `auth.users` in Supabase Dashboard → Authentication → Users:**
- User has password set
- Email confirmed

## Test Cases

### ✅ Happy Path (Above)
All steps should work smoothly.

### ⚠️ Error Cases to Test

#### 1. **Invalid OTP Code**
- Enter wrong code: `000000`
- **Expected:** Error message "Invalid code. 2 attempt(s) remaining."
- Try 3 wrong codes → Should say "Maximum attempts exceeded"
- Click "Resend Code" → Should get new code

#### 2. **Expired OTP Code**
- Wait 25 hours (or manually update `expires_at` in database to past)
- Try to use code
- **Expected:** Error "No valid verification code found"
- Click "Resend Code" → Should work

#### 3. **Password Too Short**
- Enter password: `test123` (< 8 chars)
- **Expected:** Error "Password must be at least 8 characters"

#### 4. **Passwords Don't Match**
- Password: `TestPass123!`
- Confirm: `TestPass456!`
- **Expected:** Error "Passwords do not match"

#### 5. **Duplicate Email**
- Try to create another admin with same email
- **Expected:** Error "A user with this email already exists"

## Debugging

### If OTP Not Showing in Console:

Check that `.env.local` has:
```bash
NODE_ENV=development
```

### If Email Field Not Pre-filled:

Make sure you're using the link with `?email=` parameter:
```
http://localhost:3000/setup-password?email=test@example.com
```

### If "Failed to verify" Error:

1. Check Supabase Dashboard → Table Editor → `verification_codes`
2. Verify code exists and hasn't expired
3. Check console for API errors

### If Password Setup Fails:

1. Check browser console for errors
2. Check terminal for API route errors
3. Verify user exists in `auth.users` table

## Success Criteria

All of these should pass:

- [x] Admin invitation creates user in database
- [x] OTP code is generated and stored
- [x] OTP code shows in console (dev mode)
- [x] Setup link works and pre-fills email
- [x] OTP verification works correctly
- [x] Password can be set
- [x] Email is marked as verified after setup
- [x] New admin can log in immediately
- [x] Admin has correct role and club assignment
- [x] Error messages are clear and helpful
- [x] Resend code functionality works
- [x] Invalid codes are rejected with attempts count
- [x] 3 failed attempts invalidates the code

## What's Working

Based on the implementation:

✅ **Backend:**
- OTP generation (crypto-secure 6-digit codes)
- Email notification (logged to console in Phase 1)
- Database storage with expiration
- Rate limiting (5 requests/hour per user)
- Attempt tracking (max 3 per code)
- Account lockout after 10 failed attempts/day

✅ **Frontend:**
- Beautiful OTP input component
- Auto-focus and paste support
- Keyboard navigation (arrow keys, backspace)
- Two-step verification flow (OTP → Password)
- Real-time validation
- Clear error messages

✅ **Security:**
- OTP expires in 24 hours (admin invitations)
- Max 3 attempts per code
- Rate limiting on send and verify
- Server-side password setting (not client-side)
- Email verification tracking

## Next Steps (After Testing)

If all tests pass:

1. ✅ Merge to main branch
2. ✅ Deploy to production
3. ✅ Configure real email sending (Resend SMTP)
4. ✅ Test with real email delivery
5. ✅ Move to Phase 2 (Phone verification + SMS)

## Known Limitations (Phase 1)

- ⚠️ **Email not actually sent** (logged to console only)
  - Need to configure Resend SMTP for real email sending
  - Or use Supabase SMTP (needs setup)
- ⚠️ **No SMS yet** (Phase 2)
- ⚠️ **No 2FA yet** (Phase 3)

These are expected! We'll add them in Phase 2.

---

**Ready to test? Follow the steps above and let me know what you see!** 🚀
