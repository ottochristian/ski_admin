-- Check if coaches can access athletes via RLS

-- 1. Check RLS is enabled on athletes
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'athletes';

-- 2. Show all RLS policies on athletes table
SELECT 
    'Athletes RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'athletes'
ORDER BY policyname;

-- 3. Check if there's a policy for coaches
SELECT 
    'Coach-Specific Policies' as check_type,
    policyname,
    cmd as operation,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'athletes'
  AND (policyname ILIKE '%coach%' OR qual ILIKE '%coach%')
ORDER BY policyname;

-- 4. Test: What athletes would GTSSF Coach A see? (simulating their access)
-- Note: This query runs as the current user (system admin), not as the coach
SELECT 
    'Athletes GTSSF Coach Should See' as check_type,
    a.id,
    a.first_name,
    a.last_name,
    a.club_id,
    c.name as club_name,
    ca.coach_id,
    'via coach_assignment' as access_reason
FROM athletes a
LEFT JOIN clubs c ON a.club_id = c.id
LEFT JOIN coach_assignments ca ON (
    ca.program_id IN (SELECT id FROM programs WHERE club_id = a.club_id) OR
    ca.sub_program_id IN (SELECT id FROM sub_programs WHERE club_id = a.club_id) OR
    ca.group_id IN (SELECT id FROM groups WHERE club_id = a.club_id)
)
LEFT JOIN coaches co ON ca.coach_id = co.id
LEFT JOIN profiles p ON co.profile_id = p.id
WHERE p.email = 'ottilieotto+gtssf+coach+a@gmail.com'
  AND a.club_id = '9a372457-0bae-42a7-8af8-0bbbe8bd42a6'  -- GTSSF club_id
LIMIT 10;
