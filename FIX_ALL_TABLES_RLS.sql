-- Comprehensive fix for RLS on all main tables
-- Run this to fix club_id and enable RLS on all critical tables

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

-- Fix programs club_id
UPDATE programs pr
SET club_id = s.club_id
FROM seasons s
WHERE s.id = pr.season_id
  AND pr.club_id IS DISTINCT FROM s.club_id;

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
-- STEP 3: Verification
-- ============================================

-- Check RLS status
SELECT 
  'RLS Status Check' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('athletes', 'coaches', 'households', 'programs', 'sub_programs', 'groups', 'registrations')
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

-- Check households per club
SELECT 
  'Households Per Club' as check_type,
  c.name as club_name,
  COUNT(h.id) as count
FROM clubs c
LEFT JOIN households h ON h.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Check programs per club
SELECT 
  'Programs Per Club' as check_type,
  c.name as club_name,
  COUNT(p.id) as count
FROM clubs c
LEFT JOIN programs p ON p.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

