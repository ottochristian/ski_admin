# Function Security Hardening - Search Path Fix

**Date**: January 2, 2026  
**Migration**: 51  
**Severity**: WARN (Medium) - Security Hardening  
**Status**: Ready to apply

---

## Issue: Function Search Path Mutable

**What Supabase Detected**: 21 functions without explicit `search_path` setting

**Security Risk**: 
Functions marked as `SECURITY DEFINER` run with elevated privileges. Without an explicit `search_path`, they could be vulnerable to **schema injection attacks** where a malicious user creates tables/functions in their search path that override expected behavior.

**Example Attack Vector**:
```sql
-- Attacker creates malicious table
CREATE TABLE malicious_schema.profiles (...);

-- When function runs, it might use attacker's table instead of public.profiles
-- This could lead to data leakage or privilege escalation
```

---

## The Fix

**Migration 51** adds `SET search_path = public` to all affected functions:

### Functions Fixed (21 total):

**Token/Rate Limiting**:
- `cleanup_expired_tokens`
- `cleanup_expired_rate_limits`
- `check_rate_limit`

**Email Normalization**:
- `lowercase_email`
- `lowercase_verification_contact`

**Soft Delete Operations**:
- `soft_delete_program`, `restore_program`
- `soft_delete_sub_program`, `restore_sub_program`
- `soft_delete_group`, `restore_group`

**Data Management**:
- `validate_data_integrity`
- `cleanup_orphaned_records`
- `get_data_statistics`

**System Functions**:
- `sync_household_guardian_club_id`
- `update_webhook_events_updated_at`
- `update_updated_at_column`

**Authentication/Verification**:
- `validate_otp_code`
- `check_verification_status`
- `cleanup_expired_verification_codes`

**User Management**:
- `create_parent_with_household`

---

## How to Apply

### Step 1: Run Migration 51
```sql
-- In Supabase SQL Editor:
-- Copy/paste contents of migrations/51_fix_function_search_paths.sql
-- Execute
```

### Step 2: Verify Fix
The migration includes verification queries. After running, you should see:
```
✅ Functions with search_path fixed: 21
⚠️ Still missing search_path: 0 results
```

### Step 3: Re-run Supabase Security Advisor
- Dashboard → Database → Security Advisor
- Click "Run checks"
- "Function Search Path Mutable" warnings should be gone

---

## Additional Security Issue: Leaked Password Protection

**Issue**: Password breach detection (HaveIBeenPwned) is disabled

**Risk**: LOW - Users could set passwords that are known to be compromised

**Fix**: Enable in Supabase Dashboard (2-minute task)

### How to Enable:

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Scroll to **"Password Security"** section
3. Enable **"Leaked Password Protection"**
4. Optional: Set minimum password strength requirements

**What This Does**:
- Checks passwords against HaveIBeenPwned's database of 850+ million leaked passwords
- Prevents users from using compromised passwords
- Happens client-side, passwords are never sent to HaveIBeenPwned

**Recommendation**: Enable this immediately. It's a free security improvement with no downside.

---

## Impact Assessment

### Before Fix:
- ❌ 21 functions vulnerable to schema injection
- ⚠️ Potential for privilege escalation
- ⚠️ Users can set compromised passwords

### After Fix:
- ✅ All functions explicitly set `search_path = public`
- ✅ Schema injection attack surface eliminated
- ✅ Leaked password protection enabled (manual step)

---

## Why This Matters

**Search Path Attacks are Rare but Serious**:
- Requires attacker to have database access
- Difficult to exploit in practice
- BUT could lead to privilege escalation
- Best practice: Always set `search_path` on `SECURITY DEFINER` functions

**Leaked Password Protection is Common Sense**:
- Passwords leaked in other breaches get reused
- "123456", "password123" etc. are still common
- No cost to enable, significant security benefit

---

## Testing

After applying migration 51:

1. **Verify functions still work**:
```sql
-- Test a few key functions
SELECT cleanup_expired_tokens();
SELECT check_verification_status('some-user-id', 'email_verification');
```

2. **Check no security warnings**:
```sql
-- Should return no rows
SELECT 
  p.proname 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)));
```

3. **Test application**:
- Create a new athlete (tests various functions)
- Sign up a new parent (tests OTP functions)
- Verify no errors in logs

---

## Priority

- **Migration 51**: Apply today (10 minutes)
- **Leaked Password Protection**: Enable today (2 minutes)
- **Risk if not fixed**: LOW-MEDIUM
  - Not immediately exploitable
  - But security best practice
  - Supabase recommends fixing

---

## Status Checklist

- [ ] Migration 51 applied
- [ ] Verification queries run successfully
- [ ] Security advisor re-run (should show 0 search_path warnings)
- [ ] Leaked password protection enabled
- [ ] Application tested
- [ ] No errors in production logs

---

**Total Time to Fix**: ~15 minutes  
**Security Improvement**: Significant hardening against schema injection
