-- Allow system_admin to read all data across clubs (needed for impersonation)
-- These policies add a system_admin bypass to the existing club-scoped RLS policies

-- Seasons: system_admin can view all seasons
DROP POLICY IF EXISTS "System admins can view all seasons" ON seasons;
CREATE POLICY "System admins can view all seasons"
  ON seasons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Programs: system_admin can view all programs
DROP POLICY IF EXISTS "System admins can view all programs" ON programs;
CREATE POLICY "System admins can view all programs"
  ON programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Sub-programs: system_admin can view all
DROP POLICY IF EXISTS "System admins can view all sub_programs" ON sub_programs;
CREATE POLICY "System admins can view all sub_programs"
  ON sub_programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Registrations: system_admin can view all
DROP POLICY IF EXISTS "System admins can view all registrations" ON registrations;
CREATE POLICY "System admins can view all registrations"
  ON registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Athletes: system_admin can view all
DROP POLICY IF EXISTS "System admins can view all athletes" ON athletes;
CREATE POLICY "System admins can view all athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Orders: system_admin can view all
DROP POLICY IF EXISTS "System admins can view all orders" ON orders;
CREATE POLICY "System admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Waivers: system_admin can view all
DROP POLICY IF EXISTS "System admins can view all waivers" ON waivers;
CREATE POLICY "System admins can view all waivers"
  ON waivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Coaches: system_admin can view all
DROP POLICY IF EXISTS "System admins can view all coaches" ON coaches;
CREATE POLICY "System admins can view all coaches"
  ON coaches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Households: system_admin can view all
DROP POLICY IF EXISTS "System admins can view all households" ON households;
CREATE POLICY "System admins can view all households"
  ON households FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );
