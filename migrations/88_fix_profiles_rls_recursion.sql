-- Migration 88: Fix infinite recursion in profiles RLS policies
-- Migration 87 introduced policies that subquery `profiles` from within
-- a `profiles` policy, causing 42P17 infinite recursion on login.
-- Fix: use SECURITY DEFINER helper functions that bypass RLS.

-- ── Helper functions (SECURITY DEFINER bypasses RLS, no recursion) ──────────

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_user_club_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT club_id FROM profiles WHERE id = auth.uid()
$$;

-- ── Drop all policies added in migration 87 (the recursive ones) ─────────────

DROP POLICY IF EXISTS "Admins can view club profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update club profiles" ON profiles;
DROP POLICY IF EXISTS "System admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "System admins can update all profiles" ON profiles;

-- Also drop migration 08 policies that had the same recursion pattern
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- ── Recreate policies using helper functions (no recursion) ──────────────────

-- Admin can view profiles in their own club only
CREATE POLICY "Admins can view club profiles"
ON profiles FOR SELECT TO authenticated
USING (
  auth_user_role() = 'admin'
  AND auth_user_club_id() = profiles.club_id
);

-- Admin can update profiles in their own club only
CREATE POLICY "Admins can update club profiles"
ON profiles FOR UPDATE TO authenticated
USING (
  auth_user_role() = 'admin'
  AND auth_user_club_id() = profiles.club_id
)
WITH CHECK (
  auth_user_role() = 'admin'
  AND auth_user_club_id() = profiles.club_id
);

-- system_admin can view all profiles
CREATE POLICY "System admins can view all profiles"
ON profiles FOR SELECT TO authenticated
USING (auth_user_role() = 'system_admin');

-- system_admin can update all profiles
CREATE POLICY "System admins can update all profiles"
ON profiles FOR UPDATE TO authenticated
USING (auth_user_role() = 'system_admin')
WITH CHECK (auth_user_role() = 'system_admin');

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_user_club_id() TO authenticated;
