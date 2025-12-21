# Phase 1 Implementation: Email Verification + OTP Admin Invitations

## Confirmed Requirements

Based on client decisions:
- ✅ Email verification required for all new signups
- ✅ Phone number required during signup (for future SMS features)
- ✅ OTP-based admin invitations (replace Supabase email links)
- ✅ Existing users grandfathered in
- ✅ Budget: $5-10/month for SMS

## Phase 1 Scope (This Sprint)

### What We're Building:
1. ✅ Email OTP verification after signup
2. ✅ Phone number collection during signup (validation only, no SMS verification yet)
3. ✅ OTP-based admin invitation system (email delivery)
4. ✅ Database migrations for verification tracking
5. ✅ Rate limiting and security
6. ✅ Grandfather existing users

### What We're NOT Building (Yet):
- ❌ SMS OTP delivery (Phase 2)
- ❌ Phone verification (Phase 2)
- ❌ 2FA login flow (Phase 3)
- ❌ Backup codes (Phase 3)
- ❌ Authenticator apps (Future)

## Implementation Checklist

### Step 1: Setup & Dependencies ✅
- [x] Create feature branch ✅
- [x] Twilio account created ✅
- [x] Implementation plan created ✅
- [ ] Purchase Twilio phone number
- [ ] Install dependencies
- [ ] Configure environment variables

### Step 2: Database Schema (Migration 46)
- [ ] Create `verification_codes` table
- [ ] Create `user_2fa_settings` table (minimal, for future)
- [ ] Update `profiles` table (add verification fields)
- [ ] Create indexes for performance
- [ ] Create RPC functions for OTP validation
- [ ] Migration script with rollback

### Step 3: Core Services
- [ ] `lib/services/otp-service.ts` - Generate & validate OTP codes
- [ ] `lib/services/notification-service.ts` - Email delivery (SMS ready for Phase 2)
- [ ] `lib/services/rate-limiter.ts` - Prevent abuse
- [ ] `lib/utils/phone-validation.ts` - Format & validate phone numbers
- [ ] Unit tests for services

### Step 4: API Routes
- [ ] `POST /api/otp/send` - Send OTP code (email only in Phase 1)
- [ ] `POST /api/otp/verify` - Verify OTP code
- [ ] `POST /api/otp/resend` - Resend OTP (rate limited)
- [ ] Update `POST /api/system-admin/invite-admin` - Use OTP instead of Supabase link
- [ ] `GET /api/verification/status` - Check user verification status

### Step 5: UI Components
- [ ] `<OTPInput />` - 6-digit code input component
- [ ] `<VerificationScreen />` - Generic verification UI
- [ ] `<PhoneInput />` - Phone number input with country code picker
- [ ] Update `<CreateClubAdminDialog />` - Remove email/SMS choice (email only for now)

### Step 6: Pages & Flows
- [ ] Update `/signup` - Add required phone number field
- [ ] Create `/verify-email` - Email OTP verification after signup
- [ ] Update `/setup-password` - OTP verification for admin invitations
- [ ] Middleware check for email verification
- [ ] Redirect logic for unverified users

### Step 7: Existing User Migration
- [ ] Create migration to grandfather existing users
- [ ] Set `email_verified_at = NOW()` for all current users
- [ ] Set `phone_verified_at = NOW()` for users with phone numbers
- [ ] Test migration on staging data

### Step 8: Testing
- [ ] Test email OTP delivery (Resend)
- [ ] Test OTP expiration (10 minutes)
- [ ] Test rate limiting (5 requests/hour)
- [ ] Test invalid OTP attempts (3 max)
- [ ] Test admin invitation with OTP
- [ ] Test phone number validation
- [ ] Test existing user login (should work without verification)
- [ ] Test new user signup flow (should require email verification)

### Step 9: Documentation
- [ ] Update README with new signup flow
- [ ] Document OTP system for developers
- [ ] Create user guide for email verification
- [ ] Update admin guide for new invitation process

### Step 10: Deployment
- [ ] Deploy database migration to staging
- [ ] Deploy code to staging
- [ ] Test with real users on staging
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Monitor OTP delivery rates

## Database Schema Details

### `verification_codes` Table

```sql
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- 'email_verification', 'admin_invitation', 'password_reset'
  contact VARCHAR(255) NOT NULL,  -- email address
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  CONSTRAINT unique_active_code UNIQUE (user_id, type, verified_at)
);

CREATE INDEX idx_verification_codes_user ON verification_codes(user_id);
CREATE INDEX idx_verification_codes_type ON verification_codes(type);
CREATE INDEX idx_verification_codes_expires ON verification_codes(expires_at) WHERE verified_at IS NULL;
CREATE INDEX idx_verification_codes_contact ON verification_codes(contact);
```

### Update `profiles` Table

```sql
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferred_notification_method VARCHAR(20) DEFAULT 'email';

CREATE INDEX idx_profiles_email_verified ON profiles(email_verified_at);
CREATE INDEX idx_profiles_phone_verified ON profiles(phone_verified_at);
```

### `user_2fa_settings` Table (Minimal for Future)

```sql
CREATE TABLE user_2fa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  method VARCHAR(20) DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Will add more columns in Phase 3
```

## Email Verification Flow

### New Signup Flow

```
1. User visits /signup
2. Fills in form (email, password, first name, last name, phone number, address, club)
3. Submits form
4. System creates auth.users + profile + household
5. System generates 6-digit OTP code
6. System sends OTP to user's email
7. User redirected to /verify-email?email={email}
8. User enters OTP code
9. System validates OTP
10. If valid: Set email_verified_at, redirect to /dashboard
11. If invalid: Show error, allow retry (max 3 attempts)
```

### Resend OTP Flow

```
1. User on /verify-email clicks "Resend Code"
2. System checks rate limit (max 5 per hour)
3. If under limit: Generate new OTP, invalidate old one, send email
4. If over limit: Show error with countdown timer
```

## Admin Invitation Flow

### New Admin Invitation Flow (OTP-based)

```
1. System Admin clicks "Create Admin"
2. Fills in email, name, phone (for future), club
3. System creates auth.users + profile
4. System generates 6-digit OTP
5. System sends email: "You've been invited! Your code: {OTP}"
6. New admin opens email
7. New admin visits /setup-password?email={email}
8. Enters OTP code
9. System validates OTP
10. If valid: Show password creation form
11. Admin sets password
12. Admin can now log in
```

### Email Template for Admin Invitation

```
Subject: Admin Invitation - [Club Name]

Hi [First Name],

You've been invited to join [Club Name] as an administrator.

Your verification code is: [123456]

This code expires in 10 minutes.

To complete your setup:
1. Visit: [APP_URL]/setup-password?email=[email]
2. Enter the code above
3. Create your password
4. Start managing your club!

If you didn't request this invitation, please ignore this email.

Questions? Contact support at [SUPPORT_EMAIL]

Thanks,
[Club Name] Team
```

## Rate Limiting Rules

### Per User:
- OTP requests: **5 per hour**
- Failed OTP attempts: **3 per code** (then need new code)
- Total failed attempts: **10 per 24 hours** (then temporary lock)

### Per IP:
- OTP requests: **20 per hour**
- Signup attempts: **10 per hour**

### Implementation:
```typescript
// In-memory rate limiter for now
// Phase 2: Move to Redis for distributed rate limiting

const rateLimiters = new Map<string, { count: number, resetAt: Date }>()

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimiters.get(key)
  
  if (!record || record.resetAt.getTime() < now) {
    rateLimiters.set(key, { count: 1, resetAt: new Date(now + windowMs) })
    return true
  }
  
  if (record.count >= limit) {
    return false  // Rate limit exceeded
  }
  
  record.count++
  return true
}
```

## Security Considerations

### OTP Generation:
- Use crypto.randomInt() for secure randomness
- 6 digits (000000-999999)
- No sequential patterns (123456, 111111)
- Store hashed (optional, adds complexity)

### OTP Expiration:
- Default: 10 minutes
- Admin invitations: 24 hours (longer for convenience)
- Cleanup expired codes: Cron job every hour

### Brute Force Prevention:
- Max 3 attempts per OTP code
- After 3 failures: Code is invalidated, must request new one
- Max 5 OTP requests per hour per user
- Max 10 failed OTP attempts per 24 hours (then account lock)

### Email Security:
- Use Resend (configured SMTP)
- SPF/DKIM records for domain
- Clear messaging about not sharing codes
- Link to support if user didn't request

## Phone Number Validation

### Format:
- Store in E.164 format: `+15555551234`
- Display formatted: `(555) 555-1234`
- Accept various inputs: `555-555-1234`, `5555551234`, `(555) 555-1234`

### Library:
```bash
npm install libphonenumber-js
```

### Validation:
```typescript
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

function validateAndFormatPhone(phone: string, defaultCountry = 'US'): string | null {
  try {
    if (!isValidPhoneNumber(phone, defaultCountry)) {
      return null
    }
    
    const phoneNumber = parsePhoneNumber(phone, defaultCountry)
    return phoneNumber.format('E.164')  // Returns: +15555551234
  } catch (error) {
    return null
  }
}
```

## Environment Variables (Phase 1)

```env
# Email (Resend/Supabase)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Twilio (Phone number only, no SMS yet)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555551234

# OTP Settings
OTP_EXPIRY_MINUTES=10
OTP_ADMIN_INVITATION_EXPIRY_HOURS=24
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_PER_HOUR=5

# Security
MAX_FAILED_OTP_PER_DAY=10
ACCOUNT_LOCK_DURATION_HOURS=24

# Feature Flags
ENABLE_EMAIL_VERIFICATION=true
REQUIRE_PHONE_NUMBER=true
ENABLE_SMS_VERIFICATION=false  # Phase 2
ENABLE_2FA=false  # Phase 3
```

## Success Metrics

### Phase 1 Success Criteria:
- ✅ All new signups require email verification
- ✅ OTP delivery rate > 95%
- ✅ OTP validation success rate > 90%
- ✅ Admin invitations work via OTP (no more broken Supabase emails)
- ✅ Zero security incidents (brute force, etc.)
- ✅ Existing users unaffected (grandfathered)
- ✅ Response time < 2s for OTP delivery
- ✅ Zero email delivery failures

### Monitoring:
- Track OTP send success/failure rates
- Track OTP verification success/failure rates
- Monitor rate limiting triggers
- Log all security events
- Alert on unusual patterns (spam, brute force)

## Timeline

**Phase 1 Estimated: 2 weeks**

### Week 1:
- Days 1-2: Database migrations + Core services
- Days 3-4: API routes + Testing
- Day 5: UI components

### Week 2:
- Days 1-2: Pages + Flows
- Days 3-4: Testing + Bug fixes
- Day 5: Deployment + Monitoring

## Next Steps (Right Now)

1. ✅ Purchase Twilio phone number (client action)
2. ⏭️ Install dependencies
3. ⏭️ Configure environment variables
4. ⏭️ Create database migration
5. ⏭️ Build OTP service
6. ⏭️ Build notification service
7. ⏭️ Create API routes
8. ⏭️ Build UI components
9. ⏭️ Update signup flow
10. ⏭️ Test thoroughly

**Ready to start implementing once you have your Twilio phone number!** 🚀
