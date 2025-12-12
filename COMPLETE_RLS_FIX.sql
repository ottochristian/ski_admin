-- COMPLETE RLS FIX - Run this single script to fix everything
-- This combines fixing club_id values + enabling RLS + creating policies

-- ============================================
-- STEP 1: Fix club_id values
-- ============================================

-- Fix athletes club_id
UPDATE athletes a
SET club_id = h.club_id
FROM households h
WHERE h.id = a.household_id
  AND a.club_id IS DISTINCT FROM h.club_id;

-- Fix coaches club_id
UPDATE coaches c
SET club_id = p.club_id
FROM profiles p
WHERE p.id = c.profile_id
  AND c.club_id IS DISTINCT FROM p.club_id;

-- Fix households club_id (via household_guardians)
UPDATE households h
SET club_id = p.club_id
FROM household_guardians hg
JOIN profiles p ON p.id = hg.user_id
WHERE hg.household_id = h.id
  AND hg.is_primary = true
  AND h.club_id IS DISTINCT FROM p.club_id;

-- ============================================
-- STEP 2: Enable RLS on all tables
-- ============================================

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Drop existing policies
-- ============================================

-- Drop athletes policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'athletes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON athletes', policy_record.policyname);
    END LOOP;
END $$;

-- Drop coaches policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'coaches'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON coaches', policy_record.policyname);
    END LOOP;
END $$;

-- ============================================
-- STEP 4: Create Athletes Policies
-- ============================================

-- Admins can view athletes in their club
CREATE POLICY "Admins can view athletes in their club"
ON athletes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
);

-- Admins can insert athletes in their club
CREATE POLICY "Admins can insert athletes in their club"
ON athletes FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
);

-- Admins can update athletes in their club
CREATE POLICY "Admins can update athletes in their club"
ON athletes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
);

-- Admins can delete athletes in their club
CREATE POLICY "Admins can delete athletes in their club"
ON athletes FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
);

-- Parents can view athletes in their household
CREATE POLICY "Parents can view athletes in their household"
ON athletes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = athletes.household_id
  )
);

-- ============================================
-- STEP 5: Create Coaches Policies
-- ============================================

-- Admins can view coaches in their club
CREATE POLICY "Admins can view coaches in their club"
ON coaches FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Admins can insert coaches in their club
CREATE POLICY "Admins can insert coaches in their club"
ON coaches FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Admins can update coaches in their club
CREATE POLICY "Admins can update coaches in their club"
ON coaches FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Admins can delete coaches in their club
CREATE POLICY "Admins can delete coaches in their club"
ON coaches FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Coaches can view their own profile
CREATE POLICY "Coaches can view their own profile"
ON coaches FOR SELECT TO authenticated
USING (profile_id = auth.uid());

-- Coaches can update their own profile
CREATE POLICY "Coaches can update their own profile"
ON coaches FOR UPDATE TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- ============================================
-- STEP 6: Verification
-- ============================================

-- Check RLS status
SELECT 
  'RLS Status Check' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('athletes', 'coaches', 'households', 'programs')
ORDER BY tablename;

-- Check policies created
SELECT 
  'Policies Created' as check_type,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('athletes', 'coaches')
GROUP BY tablename
ORDER BY tablename;

-- Check athletes per club
SELECT 
  'Athletes Per Club' as check_type,
  c.name as club_name,
  COUNT(a.id) as count
FROM clubs c
LEFT JOIN athletes a ON a.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Check coaches per club
SELECT 
  'Coaches Per Club' as check_type,
  c.name as club_name,
  COUNT(co.id) as count
FROM clubs c
LEFT JOIN coaches co ON co.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
