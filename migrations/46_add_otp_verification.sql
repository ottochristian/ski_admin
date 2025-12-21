-- Migration 46: Add OTP/Email Verification System
-- Phase 1: Email verification, phone collection, OTP-based admin invitations

BEGIN;

-- ============================================================================
-- 1. Create verification_codes table
-- ============================================================================
-- Stores OTP codes for email verification, admin invitations, password resets
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('email_verification', 'phone_verification', 'admin_invitation', 'password_reset', '2fa_login')),
  contact VARCHAR(255) NOT NULL,  -- Email or phone number
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Prevent multiple active codes of the same type for same user/contact
  CONSTRAINT unique_active_verification UNIQUE (user_id, type, contact, verified_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_type ON verification_codes(type);
CREATE INDEX IF NOT EXISTS idx_verification_codes_contact ON verification_codes(contact);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at) WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_verification_codes_verified ON verification_codes(verified_at) WHERE verified_at IS NOT NULL;

-- Add comment
COMMENT ON TABLE verification_codes IS 'Stores OTP codes for email/phone verification, admin invitations, and 2FA';

-- ============================================================================
-- 2. Update profiles table with verification fields
-- ============================================================================
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferred_notification_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_notification_method IN ('email', 'sms', 'both'));

-- Indexes for verification lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON profiles(email_verified_at);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON profiles(phone_verified_at);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number) WHERE phone_number IS NOT NULL;

-- Add comments
COMMENT ON COLUMN profiles.email_verified_at IS 'Timestamp when email was verified via OTP';
COMMENT ON COLUMN profiles.phone_number IS 'Phone number in E.164 format (e.g., +15555551234)';
COMMENT ON COLUMN profiles.phone_verified_at IS 'Timestamp when phone was verified via OTP';
COMMENT ON COLUMN profiles.preferred_notification_method IS 'Preferred method for receiving notifications';

-- ============================================================================
-- 3. Create user_2fa_settings table (minimal for Phase 1, expanded in Phase 3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_2fa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  method VARCHAR(20) DEFAULT 'email' CHECK (method IN ('email', 'sms', 'both', 'authenticator')),
  phone_number VARCHAR(20),  -- E.164 format
  phone_verified_at TIMESTAMPTZ,
  backup_codes TEXT[],  -- Array of hashed backup codes (added in Phase 3)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_2fa_settings_user_id ON user_2fa_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_2fa_settings_enabled ON user_2fa_settings(enabled) WHERE enabled = true;

COMMENT ON TABLE user_2fa_settings IS 'User 2FA preferences and settings (minimal in Phase 1, full in Phase 3)';

-- ============================================================================
-- 4. Create RPC function to validate OTP
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_otp_code(
  p_user_id UUID,
  p_code VARCHAR(6),
  p_type VARCHAR(50),
  p_contact VARCHAR(255)
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  attempts_remaining INTEGER
) AS $$
DECLARE
  v_verification_record RECORD;
  v_attempts_remaining INTEGER;
BEGIN
  -- Find the most recent active code for this user/type/contact
  SELECT * INTO v_verification_record
  FROM verification_codes
  WHERE user_id = p_user_id
    AND type = p_type
    AND contact = p_contact
    AND verified_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if code exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No valid verification code found. Please request a new code.', 0;
    RETURN;
  END IF;

  -- Check if max attempts exceeded
  IF v_verification_record.attempts >= v_verification_record.max_attempts THEN
    RETURN QUERY SELECT false, 'Maximum attempts exceeded. Please request a new code.', 0;
    RETURN;
  END IF;

  -- Increment attempt counter
  UPDATE verification_codes
  SET attempts = attempts + 1
  WHERE id = v_verification_record.id;

  -- Check if code matches
  IF v_verification_record.code != p_code THEN
    v_attempts_remaining := v_verification_record.max_attempts - v_verification_record.attempts - 1;
    
    IF v_attempts_remaining <= 0 THEN
      RETURN QUERY SELECT false, 'Invalid code. Maximum attempts exceeded. Please request a new code.', 0;
    ELSE
      RETURN QUERY SELECT 
        false, 
        'Invalid code. ' || v_attempts_remaining || ' attempt(s) remaining.',
        v_attempts_remaining;
    END IF;
    RETURN;
  END IF;

  -- Code is valid! Mark as verified
  UPDATE verification_codes
  SET verified_at = now()
  WHERE id = v_verification_record.id;

  -- Update profile based on verification type
  IF p_type = 'email_verification' THEN
    UPDATE profiles
    SET email_verified_at = now()
    WHERE id = p_user_id;
  ELSIF p_type = 'phone_verification' THEN
    UPDATE profiles
    SET phone_verified_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN QUERY SELECT true, 'Verification successful!', v_verification_record.max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION validate_otp_code(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;

COMMENT ON FUNCTION validate_otp_code IS 'Validates OTP code and updates verification status';

-- ============================================================================
-- 5. Create RPC function to check if user needs verification
-- ============================================================================
CREATE OR REPLACE FUNCTION check_verification_status(p_user_id UUID)
RETURNS TABLE (
  email_verified BOOLEAN,
  phone_verified BOOLEAN,
  needs_email_verification BOOLEAN,
  needs_phone_verification BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (p.email_verified_at IS NOT NULL) as email_verified,
    (p.phone_verified_at IS NOT NULL) as phone_verified,
    (p.email_verified_at IS NULL) as needs_email_verification,
    (p.phone_verified_at IS NULL AND p.phone_number IS NOT NULL) as needs_phone_verification
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_verification_status(UUID) TO authenticated;

COMMENT ON FUNCTION check_verification_status IS 'Check if user needs to complete email or phone verification';

-- ============================================================================
-- 6. Grandfather existing users (mark as verified)
-- ============================================================================
-- Mark all existing users as email verified (they signed up before this feature)
UPDATE profiles
SET email_verified_at = COALESCE(created_at, now())
WHERE email_verified_at IS NULL;

-- Mark existing users with phone numbers as phone verified (if they have one)
UPDATE profiles
SET phone_verified_at = COALESCE(created_at, now())
WHERE phone_number IS NOT NULL
  AND phone_verified_at IS NULL;

-- ============================================================================
-- 7. Create function to clean up expired verification codes (cron job)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete codes that are expired and either verified or have too many attempts
  DELETE FROM verification_codes
  WHERE expires_at < now() - INTERVAL '7 days'  -- Keep for 7 days for audit
    AND (verified_at IS NOT NULL OR attempts >= max_attempts);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO authenticated;

COMMENT ON FUNCTION cleanup_expired_verification_codes IS 'Clean up old verification codes (run via cron)';

-- ============================================================================
-- 8. Create Row Level Security (RLS) policies
-- ============================================================================

-- Enable RLS on verification_codes
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own verification codes
CREATE POLICY verification_codes_select_own
  ON verification_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users cannot insert/update/delete verification codes (only via RPC)
CREATE POLICY verification_codes_no_insert
  ON verification_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY verification_codes_no_update
  ON verification_codes
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY verification_codes_no_delete
  ON verification_codes
  FOR DELETE
  TO authenticated
  USING (false);

-- Enable RLS on user_2fa_settings
ALTER TABLE user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own 2FA settings
CREATE POLICY user_2fa_settings_select_own
  ON user_2fa_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own 2FA settings
CREATE POLICY user_2fa_settings_insert_own
  ON user_2fa_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own 2FA settings
CREATE POLICY user_2fa_settings_update_own
  ON user_2fa_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
