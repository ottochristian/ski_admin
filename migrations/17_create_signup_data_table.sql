-- Migration 17: Create temporary table to store signup data
-- This avoids metadata size limits and provides a reliable way to store signup form data
-- Data is stored here temporarily and used when user confirms email and logs in

CREATE TABLE IF NOT EXISTS signup_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  club_id UUID REFERENCES clubs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')  -- Auto-cleanup after 7 days
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_signup_data_expires_at ON signup_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_signup_data_user_id ON signup_data(user_id);

-- RLS policies
ALTER TABLE signup_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own signup data" ON signup_data;
DROP POLICY IF EXISTS "Users can read their own signup data" ON signup_data;

-- Allow users to insert their own signup data
-- Note: This requires authentication, so it won't work during signup if email confirmation is required
-- We'll use a function instead for signup
CREATE POLICY "Users can insert their own signup data"
ON signup_data
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own signup data
CREATE POLICY "Users can read their own signup data"
ON signup_data
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Drop function if it exists
DROP FUNCTION IF EXISTS public.store_signup_data(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
);

-- Function to insert signup data (bypasses RLS, can be called during signup)
CREATE OR REPLACE FUNCTION public.store_signup_data(
  p_user_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_zip_code TEXT,
  p_emergency_contact_name TEXT,
  p_emergency_contact_phone TEXT,
  p_club_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO signup_data (
    user_id,
    email,
    first_name,
    last_name,
    phone,
    address_line1,
    address_line2,
    city,
    state,
    zip_code,
    emergency_contact_name,
    emergency_contact_phone,
    club_id
  )
  VALUES (
    p_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_phone,
    p_address_line1,
    p_address_line2,
    p_city,
    p_state,
    p_zip_code,
    p_emergency_contact_name,
    p_emergency_contact_phone,
    p_club_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    address_line1 = EXCLUDED.address_line1,
    address_line2 = EXCLUDED.address_line2,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip_code = EXCLUDED.zip_code,
    emergency_contact_name = EXCLUDED.emergency_contact_name,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    club_id = EXCLUDED.club_id,
    created_at = NOW(),
    expires_at = NOW() + INTERVAL '7 days';
END;
$$;

-- Grant execute to anon users (for signup before authentication)
GRANT EXECUTE ON FUNCTION public.store_signup_data TO anon;
GRANT EXECUTE ON FUNCTION public.store_signup_data TO authenticated;

-- Function to cleanup expired signup data
CREATE OR REPLACE FUNCTION cleanup_expired_signup_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM signup_data
  WHERE expires_at < NOW();
END;
$$;

-- Note: You can set up a cron job to run cleanup_expired_signup_data() periodically
-- Or call it manually: SELECT cleanup_expired_signup_data();
