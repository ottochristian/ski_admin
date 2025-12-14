-- Diagnostic: Check GTSSF Coach A setup
-- This will show profile, club assignment, and coach record

-- 1. Check profile and club assignment
SELECT 
    'Coach Profile' as check_type,
    p.id as profile_id,
    p.email,
    p.role,
    p.first_name,
    p.last_name,
    p.club_id,
    c.name as assigned_club_name,
    c.slug as assigned_club_slug
FROM profiles p
LEFT JOIN clubs c ON p.club_id = c.id
WHERE p.email = 'ottilieotto+gtssf+coach+a@gmail.com';

-- 2. Check coaches table record
SELECT 
    'Coaches Table' as check_type,
    co.id as coach_id,
    co.profile_id,
    co.club_id as coach_club_id,
    c.name as coach_club_name,
    co.bio,
    co.specialties,
    co.created_at
FROM coaches co
LEFT JOIN clubs c ON co.club_id = c.id
WHERE co.profile_id = (
    SELECT id FROM profiles WHERE email = 'ottilieotto+gtssf+coach+a@gmail.com'
);

-- 3. Check coach assignments (programs/sub-programs/groups)
SELECT 
    'Coach Assignments' as check_type,
    ca.id as assignment_id,
    ca.coach_id,
    ca.program_id,
    pr.name as program_name,
    ca.sub_program_id,
    sp.name as sub_program_name,
    ca.group_id,
    g.name as group_name
FROM coach_assignments ca
LEFT JOIN programs pr ON ca.program_id = pr.id
LEFT JOIN sub_programs sp ON ca.sub_program_id = sp.id
LEFT JOIN groups g ON ca.group_id = g.id
WHERE ca.coach_id = (
    SELECT id FROM coaches WHERE profile_id = (
        SELECT id FROM profiles WHERE email = 'ottilieotto+gtssf+coach+a@gmail.com'
    )
);

-- 4. Check all coaches and their clubs
SELECT 
    'All Coaches Summary' as check_type,
    p.email,
    p.first_name,
    p.last_name,
    pc.name as profile_club,
    co.club_id as coach_table_club_id,
    cc.name as coach_table_club_name,
    CASE 
        WHEN p.club_id = co.club_id THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as club_consistency
FROM profiles p
LEFT JOIN coaches co ON co.profile_id = p.id
LEFT JOIN clubs pc ON p.club_id = pc.id
LEFT JOIN clubs cc ON co.club_id = cc.id
WHERE p.role = 'coach'
ORDER BY pc.name, p.email;
