# OTP/2FA & Email Verification Implementation Plan

## Project Overview

Implement a secure, unified notification and verification system for:
- Two-Factor Authentication (2FA) via SMS/Email
- Email verification for new signups
- Phone number verification
- Admin invitation system (email + SMS)
- Password reset via email/SMS

## Phase 1: Foundation & Infrastructure

### 1.1 Service Providers Setup
- [x] Twilio account created ✅
- [ ] Twilio phone number purchased
- [ ] Twilio API credentials configured
- [ ] Resend account created (for email)
- [ ] Supabase SMTP configured with Resend

### 1.2 Database Schema Extensions

#### New Tables

**`verification_codes`** - Store OTP codes for verification
```sql
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,  -- 6-digit OTP
  type VARCHAR(50) NOT NULL,  -- 'email_verification', 'phone_verification', '2fa_login', 'password_reset'
  contact VARCHAR(255) NOT NULL,  -- email or phone number
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(45),  -- Track for security
  user_agent TEXT,  -- Track for security
  
  -- Prevent brute force
  CONSTRAINT unique_active_code UNIQUE (user_id, type, contact, verified_at)
);

CREATE INDEX idx_verification_codes_user_type ON verification_codes(user_id, type);
CREATE INDEX idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX idx_verification_codes_contact ON verification_codes(contact);
```

**`user_2fa_settings`** - Store user 2FA preferences
```sql
CREATE TABLE user_2fa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  method VARCHAR(20) DEFAULT 'email',  -- 'email', 'sms', 'both'
  phone_number VARCHAR(20),  -- E.164 format
  phone_verified_at TIMESTAMPTZ,
  backup_codes TEXT[],  -- Array of backup codes (hashed)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_2fa_settings_user ON user_2fa_settings(user_id);
```

**Update `profiles` table**
```sql
ALTER TABLE profiles 
  ADD COLUMN email_verified_at TIMESTAMPTZ,
  ADD COLUMN phone_number VARCHAR(20),
  ADD COLUMN phone_verified_at TIMESTAMPTZ,
  ADD COLUMN preferred_notification_method VARCHAR(20) DEFAULT 'email';  -- 'email', 'sms', 'both'
```

### 1.3 Environment Variables

```env
# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555551234

# Resend (Email)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# OTP Settings
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_PER_HOUR=5

# 2FA Settings
ENABLE_2FA=true
REQUIRE_EMAIL_VERIFICATION=true
```

### 1.4 Core Services Architecture

```
lib/services/
├── notification-service.ts      # Unified email + SMS sending
├── otp-service.ts               # OTP generation, validation, storage
├── verification-service.ts      # Email/phone verification logic
├── 2fa-service.ts               # 2FA enrollment, validation
└── rate-limiter.ts              # Prevent abuse
```

---

## Phase 2: OTP Service (Foundation)

### 2.1 OTP Generation & Storage

**Key Features:**
- Generate secure 6-digit codes
- Store with expiration (10 minutes default)
- Track attempts to prevent brute force
- Rate limiting per user/IP
- Clean up expired codes automatically

**Security Considerations:**
- Hash codes before storage (optional, adds complexity)
- Implement exponential backoff after failed attempts
- Rate limit: Max 5 OTP requests per hour per user
- Lock account after 10 failed attempts in 24 hours

### 2.2 OTP Delivery

**Channels:**
- SMS (via Twilio)
- Email (via Resend/Supabase)
- Both (redundancy)

**Message Templates:**
```
SMS: "Your verification code is: {code}. Valid for 10 minutes. Do not share this code."

Email: More detailed with branding, security tips, "didn't request?" link
```

---

## Phase 3: Email Verification

### 3.1 Signup Flow with Email Verification

**Current Flow:**
```
User signs up → Profile created → Can log in immediately
```

**New Flow:**
```
User signs up → 
  Profile created (email_verified_at = NULL) → 
  6-digit OTP sent to email → 
  User enters OTP → 
  email_verified_at set → 
  Full access granted
```

**Implementation:**
1. Modify signup form to show OTP input after successful signup
2. Send OTP immediately after signup
3. User enters OTP on verification screen
4. Set `email_verified_at` upon successful verification
5. Middleware checks verification status before allowing access

### 3.2 Email Verification UI Flow

```
/signup
  └─> Success → Redirect to /verify-email?email={email}
      └─> Enter 6-digit code
      └─> [Resend Code] button (rate limited)
      └─> Success → Redirect to /dashboard or /setup-profile
```

### 3.3 Unverified User Restrictions

**Blocked Actions (until email verified):**
- Register athletes
- Make payments
- View sensitive data

**Allowed Actions:**
- View public pages
- Update profile
- Request new verification code
- Contact support

---

## Phase 4: Phone Verification

### 4.1 Phone Number Collection

**Where:**
- During signup (optional field)
- Profile settings (add later)
- Admin invitation (system admin adds phone for new admins)

**Validation:**
- Use libphonenumber-js for parsing/validation
- Store in E.164 format (e.g., +15555551234)
- Validate country code

### 4.2 Phone Verification Flow

```
User enters phone → 
  Validate format → 
  Send SMS with OTP → 
  User enters code → 
  phone_verified_at set
```

---

## Phase 5: Two-Factor Authentication (2FA)

### 5.1 2FA Enrollment

**Opt-in Process:**
1. User goes to Profile → Security → Enable 2FA
2. Choose method: Email, SMS, or Both
3. If SMS: Verify phone number first (if not already verified)
4. Generate 10 backup codes (in case they lose access)
5. User downloads/prints backup codes
6. 2FA enabled

**UI:**
```
Profile → Security Settings
  [x] Enable Two-Factor Authentication
  
  Method:
    ( ) Email only
    ( ) SMS only  (requires verified phone)
    (•) Email + SMS (most secure)
  
  Backup Codes (10):
    - ABCD-1234-EFGH
    - IJKL-5678-MNOP
    (Download as PDF | Print)
```

### 5.2 2FA Login Flow

**With 2FA Enabled:**
```
User enters email + password → 
  Credentials valid → 
  Send OTP to chosen method(s) → 
  Show OTP input screen → 
  User enters 6-digit code → 
  Success → Create session
```

**Failed Attempts:**
- 3 attempts per OTP (then need to request new code)
- 10 failed OTPs in 24h = temporary account lock
- Email notification on suspicious activity

### 5.3 Backup Codes

**Purpose:** Account recovery if user loses phone/email access

**Features:**
- 10 single-use codes generated at enrollment
- Hashed before storage
- Can regenerate codes (invalidates old ones)
- Use backup code in place of OTP during login

**UI Flow:**
```
Login screen with 2FA:
  [Enter 6-digit code]
  
  Can't access? [Use backup code]
  
  Lost access? [Contact Support]
```

---

## Phase 6: Admin Invitation Enhancement

### 6.1 Current Flow
```
System Admin invites → 
  Profile created → 
  Email sent (NOT WORKING - SMTP not configured)
```

### 6.2 New Flow with OTP
```
System Admin invites →
  Choose notification method: Email | SMS | Both →
  Profile created →
  OTP sent via chosen method(s) →
  New admin receives code →
  Visits /setup-password?code={code} →
  Enters OTP + sets password →
  Account activated
```

### 6.3 UI Updates

**Create Admin Dialog:**
```
Email: [___________]
Phone: [___________] (optional)

First Name: [___________]
Last Name:  [___________]

Club: [Select Club ▼]

Notification Method:
  ( ) Email only
  ( ) SMS only (requires phone)
  (•) Both Email + SMS
  
[Send Invitation]
```

---

## Phase 7: Password Reset Enhancement

### 7.1 Current Flow
```
User clicks "Forgot Password" →
  Supabase sends reset link →
  User clicks link →
  Sets new password
```

### 7.2 New Flow with OTP
```
User clicks "Forgot Password" →
  Enters email (or phone if 2FA enabled) →
  Choose: Email | SMS | Both →
  OTP sent →
  User enters code →
  Verified → Show password reset form →
  New password set
```

### 7.3 Security Enhancements
- Rate limit: 3 password resets per 24 hours
- Notify via alternate method (if user has both email + SMS)
- Log all password reset attempts
- Show recent activity in profile settings

---

## Phase 8: Rate Limiting & Security

### 8.1 Rate Limits

**Per User:**
- OTP requests: 5 per hour
- Failed OTP attempts: 10 per 24 hours (then lock)
- Password resets: 3 per 24 hours

**Per IP:**
- OTP requests: 20 per hour
- Login attempts: 50 per hour

### 8.2 Brute Force Prevention

**Strategies:**
- Exponential backoff (1s → 2s → 4s → 8s → ...)
- CAPTCHA after 3 failed attempts
- Temporary account lock after threshold
- Email notification on suspicious activity

### 8.3 Security Logging

**Log Events:**
- OTP sent (method, timestamp)
- OTP verified (success/failure)
- 2FA enabled/disabled
- Backup codes regenerated
- Suspicious activity detected

**Storage:**
Create `security_logs` table for audit trail

---

## Phase 9: User Experience

### 9.1 New Pages/Routes

```
/verify-email              # Email verification after signup
/verify-phone              # Phone verification
/setup-password?code=xxx   # Admin invitation acceptance
/profile/security          # 2FA settings, backup codes, security logs
/login?2fa=required        # 2FA code entry during login
```

### 9.2 Email Templates

**Template Types:**
- OTP Code (signup, login, password reset)
- 2FA Enabled Confirmation
- Suspicious Activity Alert
- Backup Codes (PDF download)
- Admin Invitation

**Branding:**
- Club logo
- Club colors
- Professional, clear messaging
- Security tips

### 9.3 SMS Templates (160 char limit)

```
"Your {APP_NAME} code: {CODE}. Valid 10 min. Ref: {REF_ID}"

"Welcome to {CLUB_NAME}! Code: {CODE} to complete setup."

"Security alert: 2FA code: {CODE}. Didn't request? Contact us."
```

---

## Phase 10: Migration Strategy

### 10.1 Existing Users

**No 2FA (default):**
- Existing users continue without 2FA
- Show banner: "Secure your account - Enable 2FA"
- Optional, not enforced

**Email Verification:**
- Existing users marked as verified (grandfathered)
- Only NEW signups require verification
- Existing users can verify later for added security

### 10.2 Rollout Plan

**Week 1:**
- Deploy database migrations
- Deploy notification service (email + SMS)
- Test with internal accounts

**Week 2:**
- Deploy email verification for new signups
- Deploy phone verification (optional)
- Monitor error rates

**Week 3:**
- Deploy 2FA opt-in for all users
- Send announcement email
- Provide documentation/tutorials

**Week 4:**
- Deploy enhanced admin invitation with OTP
- Deploy password reset with OTP option
- Full production rollout

---

## Implementation Checklist

### Phase 1: Setup ✅
- [x] Create feature branch
- [ ] Install dependencies (twilio, resend, libphonenumber-js)
- [ ] Configure environment variables
- [ ] Set up Twilio phone number
- [ ] Configure Resend SMTP in Supabase

### Phase 2: Database
- [ ] Create `verification_codes` table
- [ ] Create `user_2fa_settings` table
- [ ] Update `profiles` table with verification fields
- [ ] Create `security_logs` table
- [ ] Write RPC functions for OTP validation
- [ ] Test migrations

### Phase 3: Core Services
- [ ] Build `notification-service.ts` (email + SMS)
- [ ] Build `otp-service.ts` (generate, validate)
- [ ] Build `verification-service.ts`
- [ ] Build `2fa-service.ts`
- [ ] Build `rate-limiter.ts`
- [ ] Unit tests for services

### Phase 4: API Routes
- [ ] `/api/otp/send` - Send OTP
- [ ] `/api/otp/verify` - Verify OTP
- [ ] `/api/2fa/enroll` - Enable 2FA
- [ ] `/api/2fa/verify` - Verify during login
- [ ] `/api/verification/email` - Email verification
- [ ] `/api/verification/phone` - Phone verification
- [ ] Update `/api/system-admin/invite-admin` with OTP

### Phase 5: UI Components
- [ ] `<OTPInput />` - 6-digit code input
- [ ] `<VerificationScreen />` - Generic verification UI
- [ ] `<2FASetup />` - 2FA enrollment wizard
- [ ] `<BackupCodes />` - Display/download backup codes
- [ ] `<SecuritySettings />` - Profile security page
- [ ] Update login flow for 2FA

### Phase 6: Pages
- [ ] `/verify-email` page
- [ ] `/verify-phone` page
- [ ] `/profile/security` page
- [ ] `/setup-password` (enhanced)
- [ ] `/login` (2FA support)

### Phase 7: Testing
- [ ] Test email OTP delivery
- [ ] Test SMS OTP delivery
- [ ] Test rate limiting
- [ ] Test brute force prevention
- [ ] Test backup codes
- [ ] Test admin invitation flow
- [ ] Test password reset flow
- [ ] Security audit

### Phase 8: Documentation
- [ ] User guide: How to enable 2FA
- [ ] Admin guide: How to invite users
- [ ] Developer docs: Service architecture
- [ ] Security policy document
- [ ] Troubleshooting guide

### Phase 9: Deployment
- [ ] Deploy to staging
- [ ] Test with real users
- [ ] Monitor Twilio usage/costs
- [ ] Monitor error logs
- [ ] Deploy to production
- [ ] Send announcement to existing users

---

## Cost Estimates

### Twilio (SMS)

**Expected Usage:**
- Admin invitations: ~50/month = $0.40
- 2FA logins: ~500/month = $3.95
- Phone verifications: ~100/month = $0.79
- **Total: ~$5-10/month**

### Resend (Email)

**Expected Usage:**
- Within free tier (3,000/month)
- **Cost: $0**

### Total Monthly Cost
- **~$5-10/month** (very affordable)

---

## Security Considerations

### Best Practices
✅ Rate limiting on all OTP endpoints
✅ Exponential backoff after failures
✅ Hash backup codes before storage
✅ Log all security events
✅ Notify users of suspicious activity
✅ HTTPS only (already enforced)
✅ Secure session management (Supabase)
✅ CSRF protection (Next.js built-in)

### Compliance
- **GDPR**: Log retention policy (90 days)
- **CCPA**: Allow users to export security logs
- **SOC 2**: Audit trail of all auth events

---

## Future Enhancements (Post-Launch)

### Phase 11: Advanced Features
- Authenticator app support (TOTP via Google Authenticator)
- WebAuthn/Passkeys (biometric authentication)
- Risk-based authentication (detect unusual locations)
- Session management (view all devices, remote logout)
- Notification preferences (per event type)

### Phase 12: Communication Center
- Coach → Parent messaging
- Team announcements
- Event notifications
- Emergency alerts
- (Separate project scope)

---

## Decision Points ✅ CONFIRMED

**Client decisions (confirmed):**

1. **2FA Enforcement:**
   - [x] **Required for admins, optional for parents** ✅
   - Admins will be required to enable 2FA within 7 days of account creation
   - Parents can opt-in anytime

2. **Email Verification:**
   - [x] **Required for all new signups** ✅
   - Existing users grandfathered in (marked as verified)
   - Must verify email before accessing core features

3. **Phone Verification:**
   - [x] **Required during signup** ✅
   - Phone number is mandatory field
   - Must verify phone via SMS OTP during signup process
   - Reason: Future SMS communication (coaches ↔ parents, admins ↔ coaches)

4. **Default 2FA Method:**
   - [x] **SMS preferred (since phone is required)** ✅
   - Fallback to email if SMS fails
   - User can choose "Both" for maximum security

5. **Backup Codes:**
   - [x] **10 codes (standard)** ✅
   - Generated at 2FA enrollment
   - Can regenerate anytime (invalidates old codes)

**Implementation Scope:**
- [x] **Option B - Phased Approach** ✅
  - **Phase 1 (Current):** Email verification + OTP admin invitations
  - **Phase 2 (Next):** Phone verification + SMS support
  - **Phase 3 (Final):** 2FA enrollment + backup codes

**Budget:**
- [x] **$5-10/month** approved for SMS costs ✅
- Scaling budget as needed for future communication features

**Migration Strategy:**
- [x] **Grandfather existing users** ✅
- Mark all current users as verified (both email and phone)
- Only NEW signups require verification
- Test with a few new accounts before full rollout

---

## Next Steps

1. **Review this plan** - Confirm approach and decisions
2. **Install dependencies** - Set up Twilio, Resend
3. **Create database migrations** - Schema changes
4. **Build core services** - OTP, verification, 2FA
5. **Implement UI components** - OTP input, verification screens
6. **Test thoroughly** - Security, rate limiting, edge cases
7. **Deploy to staging** - Real-world testing
8. **Production rollout** - Monitor closely

**Estimated Timeline:**
- Week 1-2: Infrastructure + Core Services
- Week 3: UI Components + Pages
- Week 4: Testing + Bug Fixes
- Week 5: Staging Deployment + Real User Testing
- Week 6: Production Rollout

---

## Questions for You

1. Do you want 2FA to be **optional** or **required for admins**?
2. Should we enforce email verification for **all new signups** or make it optional?
3. What's your budget comfort level for SMS costs? (~$5-10/month initially)
4. Do you want to collect phone numbers during **signup** or let users add them later?
5. Should we implement **all features** or start with a subset (e.g., email verification + optional 2FA)?

Let me know your preferences and I'll start implementing! 🚀
