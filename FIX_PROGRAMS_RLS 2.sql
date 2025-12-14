-- Fix RLS for programs, sub_programs, and groups tables
-- This will stop duplicate programs from showing up

-- ============================================
-- STEP 1: Fix club_id values
-- ============================================

-- Fix programs club_id (should match their season's club)
UPDATE programs p
SET club_id = s.club_id
FROM seasons s
WHERE s.id = p.season_id
  AND p.club_id IS DISTINCT FROM s.club_id;

-- Fix sub_programs club_id (should match their program's club)
UPDATE sub_programs sp
SET club_id = p.club_id
FROM programs p
WHERE p.id = sp.program_id
  AND sp.club_id IS DISTINCT FROM p.club_id;

-- Fix groups club_id (should match their sub_program's club)
UPDATE groups g
SET club_id = sp.club_id
FROM sub_programs sp
WHERE sp.id = g.sub_program_id
  AND g.club_id IS DISTINCT FROM sp.club_id;

-- ============================================
-- STEP 2: Enable RLS
-- ============================================

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Drop existing policies
-- ============================================

-- Drop programs policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'programs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON programs', policy_record.policyname);
    END LOOP;
END $$;

-- Drop sub_programs policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'sub_programs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sub_programs', policy_record.policyname);
    END LOOP;
END $$;

-- Drop groups policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'groups'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON groups', policy_record.policyname);
    END LOOP;
END $$;

-- ============================================
-- STEP 4: Create Programs Policies
-- ============================================

CREATE POLICY "Admins can view programs in their club"
ON programs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = programs.club_id
  )
);

CREATE POLICY "Admins can insert programs in their club"
ON programs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = programs.club_id
  )
);

CREATE POLICY "Admins can update programs in their club"
ON programs FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = programs.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = programs.club_id
  )
);

CREATE POLICY "Admins can delete programs in their club"
ON programs FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = programs.club_id
  )
);

-- Parents can view programs in their club
CREATE POLICY "Parents can view programs in their club"
ON programs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'parent'
      AND p.club_id = programs.club_id
  )
);

-- ============================================
-- STEP 5: Create Sub-Programs Policies
-- ============================================

CREATE POLICY "Admins can view sub_programs in their club"
ON sub_programs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = sub_programs.club_id
  )
);

CREATE POLICY "Admins can insert sub_programs in their club"
ON sub_programs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = sub_programs.club_id
  )
);

CREATE POLICY "Admins can update sub_programs in their club"
ON sub_programs FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = sub_programs.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = sub_programs.club_id
  )
);

CREATE POLICY "Admins can delete sub_programs in their club"
ON sub_programs FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = sub_programs.club_id
  )
);

-- Parents can view sub_programs in their club
CREATE POLICY "Parents can view sub_programs in their club"
ON sub_programs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'parent'
      AND p.club_id = sub_programs.club_id
  )
);

-- ============================================
-- STEP 6: Create Groups Policies
-- ============================================

CREATE POLICY "Admins can view groups in their club"
ON groups FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = groups.club_id
  )
);

CREATE POLICY "Admins can insert groups in their club"
ON groups FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = groups.club_id
  )
);

CREATE POLICY "Admins can update groups in their club"
ON groups FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = groups.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = groups.club_id
  )
);

CREATE POLICY "Admins can delete groups in their club"
ON groups FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = groups.club_id
  )
);

-- ============================================
-- STEP 7: Verification
-- ============================================

-- Check RLS status
SELECT 
  'RLS Status' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('programs', 'sub_programs', 'groups')
ORDER BY tablename;

-- Check policies created
SELECT 
  'Policies Created' as check_type,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('programs', 'sub_programs', 'groups')
GROUP BY tablename
ORDER BY tablename;

-- Check programs per club
SELECT 
  'Programs Per Club' as check_type,
  c.name as club_name,
  COUNT(DISTINCT p.id) as program_count,
  array_agg(DISTINCT p.name ORDER BY p.name) as programs
FROM clubs c
LEFT JOIN programs p ON p.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Check sub_programs per club
SELECT 
  'Sub-Programs Per Club' as check_type,
  c.name as club_name,
  COUNT(sp.id) as subprogram_count
FROM clubs c
LEFT JOIN sub_programs sp ON sp.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
