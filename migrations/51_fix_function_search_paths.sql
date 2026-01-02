-- Migration 51: Fix Function Search Paths (Security Hardening)
-- Addresses Supabase security warning: "Function Search Path Mutable"
-- 
-- Why this matters:
-- Without SET search_path, functions could be vulnerable to schema injection attacks
-- where an attacker creates malicious tables/functions in their search path
-- 
-- Fix: Add "SET search_path = public" to all SECURITY DEFINER functions

BEGIN;

-- ============================================================================
-- 1. Token/Rate Limiting Functions (Migration 48)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM used_tokens
  WHERE expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at < now();
END;
$$;

-- Note: check_rate_limit function is complex, keeping original but adding search_path
-- (Full function body would be too long to recreate here safely)
-- Instead, we'll ALTER it to add search_path
ALTER FUNCTION check_rate_limit(text, text, integer, interval) SET search_path = public;

-- ============================================================================
-- 2. Email Normalization Functions (Migration 47)
-- ============================================================================

-- These are simple trigger functions, adding search_path
ALTER FUNCTION lowercase_email() SET search_path = public;
ALTER FUNCTION lowercase_verification_contact() SET search_path = public;

-- ============================================================================
-- 3. Soft Delete Functions (Migrations 44, 45)
-- ============================================================================

ALTER FUNCTION soft_delete_program(uuid) SET search_path = public;
ALTER FUNCTION restore_program(uuid) SET search_path = public;
ALTER FUNCTION soft_delete_sub_program(uuid) SET search_path = public;
ALTER FUNCTION restore_sub_program(uuid) SET search_path = public;
ALTER FUNCTION soft_delete_group(uuid) SET search_path = public;
ALTER FUNCTION restore_group(uuid) SET search_path = public;

-- ============================================================================
-- 4. Data Validation/Cleanup Functions
-- ============================================================================

ALTER FUNCTION validate_data_integrity() SET search_path = public;
ALTER FUNCTION cleanup_orphaned_records() SET search_path = public;
ALTER FUNCTION get_data_statistics() SET search_path = public;

-- ============================================================================
-- 5. Household/Club Functions (Migration 38)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_household_guardian_club_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If club_id is not set, get it from the household
  IF NEW.club_id IS NULL AND NEW.household_id IS NOT NULL THEN
    SELECT h.club_id INTO NEW.club_id
    FROM households h
    WHERE h.id = NEW.household_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. Webhook Functions (Migration 28)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. OTP Verification Functions (Migration 46)
-- ============================================================================

ALTER FUNCTION validate_otp_code(uuid, varchar, varchar, varchar) SET search_path = public;
ALTER FUNCTION check_verification_status(uuid, varchar) SET search_path = public;

CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < now()
    AND verified_at IS NULL;
END;
$$;

-- ============================================================================
-- 8. Timestamp Update Function (Common across many migrations)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 9. Parent/Household Creation Function
-- ============================================================================

ALTER FUNCTION create_parent_with_household(uuid, text, text, text, uuid, text, text, text, text, text, text, text) SET search_path = public;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all functions now have search_path set
SELECT 
  'Functions with search_path fixed' as status,
  COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true  -- SECURITY DEFINER functions
  AND p.proconfig IS NOT NULL  -- Has configuration (search_path)
  AND 'search_path=public' = ANY(p.proconfig);

-- List any remaining functions without search_path (should be empty)
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  '⚠️ Still missing search_path' as warning
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true  -- SECURITY DEFINER functions
  AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)));

COMMIT;
