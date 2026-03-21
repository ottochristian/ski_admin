-- Migration 87: Fix critical RLS security issues (security audit 2026-03-21)
--
-- Issues fixed:
-- 1. profiles: admin policy lacked club_id scoping (cross-club data leakage)
-- 2. webhook_events: open to all authenticated users (Stripe data exposure)
-- 3. club_requests: RLS not enabled at all (any user could read all requests)
-- 4. impersonation_logs: RLS enabled but no policies (audit log not readable by system_admin)
-- 5. guardian_invitations: token-viewing policy exposed all pending invitations to any authenticated user

-- ============================================================
-- 1. FIX profiles: scope admin policy to same club only
-- ============================================================

-- Drop the overbroad policies from migration 08
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Admin can only view profiles within their own club
CREATE POLICY "Admins can view club profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role = 'admin'
      AND caller.club_id = profiles.club_id
  )
);

-- Admin can only update profiles within their own club
CREATE POLICY "Admins can update club profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role = 'admin'
      AND caller.club_id = profiles.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role = 'admin'
      AND caller.club_id = profiles.club_id
  )
);

-- system_admin can view all profiles (needed for system admin portal)
DROP POLICY IF EXISTS "System admins can view all profiles" ON profiles;
CREATE POLICY "System admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS caller
    WHERE caller.id = auth.uid() AND caller.role = 'system_admin'
  )
);

-- system_admin can update all profiles (needed for system admin portal)
DROP POLICY IF EXISTS "System admins can update all profiles" ON profiles;
CREATE POLICY "System admins can update all profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS caller
    WHERE caller.id = auth.uid() AND caller.role = 'system_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles AS caller
    WHERE caller.id = auth.uid() AND caller.role = 'system_admin'
  )
);

-- ============================================================
-- 2. FIX webhook_events: remove open authenticated access
-- Service role bypasses RLS — no policy needed for API routes
-- that use the service role key. No authenticated user should
-- ever query this table directly.
-- ============================================================

DROP POLICY IF EXISTS "Service role can manage webhook events" ON webhook_events;

-- No replacement policy — service_role bypasses RLS.
-- Any direct authenticated access is denied by default.

-- ============================================================
-- 3. FIX club_requests: enable RLS + add proper policies
-- ============================================================

ALTER TABLE club_requests ENABLE ROW LEVEL SECURITY;

-- Users can submit and view their own requests
CREATE POLICY "Users can insert their own club request"
ON club_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own club request"
ON club_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- system_admin can view and manage all requests
CREATE POLICY "System admins can manage all club requests"
ON club_requests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'system_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'system_admin'
  )
);

-- ============================================================
-- 4. FIX impersonation_logs: add system_admin read policy
-- Service role still writes (bypasses RLS). system_admin can
-- read logs for the audit log UI.
-- ============================================================

DROP POLICY IF EXISTS "System admins can view impersonation logs" ON impersonation_logs;
CREATE POLICY "System admins can view impersonation logs"
ON impersonation_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'system_admin'
  )
);

-- ============================================================
-- 5. FIX guardian_invitations: remove overbroad token policy
-- The acceptance flow uses the service_role API route which
-- bypasses RLS. Exposing all pending invitations to any
-- authenticated user is unnecessary and leaks email addresses.
-- ============================================================

DROP POLICY IF EXISTS "Users can view invitations by token" ON guardian_invitations;

-- Token lookups are handled server-side via service_role.
-- No replacement policy — unauthenticated/cross-household access
-- should go through the server-side accept endpoint only.
