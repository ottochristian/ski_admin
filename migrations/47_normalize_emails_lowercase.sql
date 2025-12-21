-- Migration 47: Normalize all emails to lowercase
-- Best practice: Emails are case-insensitive by RFC, should be stored lowercase

BEGIN;

-- ============================================================================
-- 1. Update existing emails in profiles to lowercase
-- ============================================================================
UPDATE profiles
SET email = LOWER(email)
WHERE email != LOWER(email);

-- ============================================================================
-- 2. Create a function to automatically lowercase emails on insert/update
-- ============================================================================
CREATE OR REPLACE FUNCTION lowercase_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically lowercase the email on insert or update
  NEW.email = LOWER(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Create trigger on profiles table
-- ============================================================================
DROP TRIGGER IF EXISTS ensure_lowercase_email ON profiles;

CREATE TRIGGER ensure_lowercase_email
  BEFORE INSERT OR UPDATE OF email
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email();

-- ============================================================================
-- 4. Update verification_codes contact to lowercase
-- ============================================================================
UPDATE verification_codes
SET contact = LOWER(contact)
WHERE contact != LOWER(contact);

-- Create function for verification_codes
CREATE OR REPLACE FUNCTION lowercase_verification_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically lowercase the contact (email/phone) on insert or update
  NEW.contact = LOWER(NEW.contact);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for verification_codes
DROP TRIGGER IF EXISTS ensure_lowercase_verification_contact ON verification_codes;

CREATE TRIGGER ensure_lowercase_verification_contact
  BEFORE INSERT OR UPDATE OF contact
  ON verification_codes
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_verification_contact();

-- ============================================================================
-- 5. Add check constraint to ensure emails are lowercase (belt & suspenders)
-- ============================================================================
-- This ensures even if trigger is bypassed, the constraint catches it
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_email_lowercase_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_email_lowercase_check
  CHECK (email = LOWER(email));

-- ============================================================================
-- 6. Create index on lowercase email for faster lookups
-- ============================================================================
-- Drop old index if exists
DROP INDEX IF EXISTS idx_profiles_email_lower;

-- Create new index (the trigger ensures email is already lowercase)
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(email);

-- Add comment
COMMENT ON CONSTRAINT profiles_email_lowercase_check ON profiles IS 'Ensures all email addresses are stored in lowercase';

COMMIT;
