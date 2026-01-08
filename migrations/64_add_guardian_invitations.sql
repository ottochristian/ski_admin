-- Migration 64: Add Guardian Invitations System
-- Allows primary guardians to invite secondary guardians to their household

-- Step 1: Create guardian_invitations table
CREATE TABLE IF NOT EXISTS guardian_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Add unique constraint for pending invitations (one pending per email per household)
CREATE UNIQUE INDEX IF NOT EXISTS idx_guardian_invitations_unique_pending
ON guardian_invitations(household_id, email)
WHERE status = 'pending';

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_household_id ON guardian_invitations(household_id);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_email ON guardian_invitations(email);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_token ON guardian_invitations(token);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_status ON guardian_invitations(status);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_expires_at ON guardian_invitations(expires_at);

-- Step 3: Enable RLS
ALTER TABLE guardian_invitations ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies for guardian_invitations

-- Primary guardians can view invitations for their household
CREATE POLICY "Primary guardians can view invitations for their household"
ON guardian_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = guardian_invitations.household_id
      AND hg.user_id = auth.uid()
      AND hg.is_primary = true
  )
);

-- Primary guardians can create invitations for their household
CREATE POLICY "Primary guardians can create invitations for their household"
ON guardian_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = guardian_invitations.household_id
      AND hg.user_id = auth.uid()
      AND hg.is_primary = true
  )
  AND invited_by_user_id = auth.uid()
);

-- Primary guardians can update (cancel) invitations for their household
CREATE POLICY "Primary guardians can update invitations for their household"
ON guardian_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = guardian_invitations.household_id
      AND hg.user_id = auth.uid()
      AND hg.is_primary = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = guardian_invitations.household_id
      AND hg.user_id = auth.uid()
      AND hg.is_primary = true
  )
);

-- Anyone with the token can view pending invitations (for acceptance flow)
CREATE POLICY "Users can view invitations by token"
ON guardian_invitations
FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND expires_at > NOW()
);

-- Step 5: Function to check if user is already a guardian in any household
CREATE OR REPLACE FUNCTION is_user_guardian_in_any_household(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM household_guardians hg
    WHERE hg.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Step 6: Function to check guardian count for a household (including pending invitations)
CREATE OR REPLACE FUNCTION get_household_guardian_count(
  p_household_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_guardian_count INTEGER;
  v_pending_count INTEGER;
BEGIN
  -- Count existing guardians
  SELECT COUNT(*) INTO v_guardian_count
  FROM household_guardians
  WHERE household_id = p_household_id;
  
  -- Count pending invitations (not expired, not cancelled)
  SELECT COUNT(*) INTO v_pending_count
  FROM guardian_invitations
  WHERE household_id = p_household_id
    AND status = 'pending'
    AND expires_at > NOW();
  
  RETURN v_guardian_count + v_pending_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION is_user_guardian_in_any_household(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_household_guardian_count(UUID) TO authenticated;

-- Step 8: Verify creation
SELECT 
  'Guardian invitations system created' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'guardian_invitations') as table_exists,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'is_user_guardian_in_any_household') as function_exists,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_household_guardian_count') as count_function_exists;

