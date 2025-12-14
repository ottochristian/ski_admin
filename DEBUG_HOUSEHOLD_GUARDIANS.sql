-- Debug: Check household_guardians linkage for Jackson Parent A
-- This will show if the user_id is correctly linked to household_id

-- 1. Find Jackson Parent A profile
SELECT 
    'Jackson Parent A Profile' as check_type,
    p.id as profile_id,
    p.email,
    p.role,
    p.club_id,
    c.name as club_name
FROM profiles p
LEFT JOIN clubs c ON p.club_id = c.id
WHERE p.email = 'ottilieotto+jackson+parent+a@gmail.com';

-- 2. Check if auth.users has this email
SELECT 
    'Auth Users' as check_type,
    id as auth_user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'ottilieotto+jackson+parent+a@gmail.com';

-- 3. Check household_guardians for this user (using profile.id since household_guardians.user_id references profiles.id)
SELECT 
    'Household Guardians (by profile.id)' as check_type,
    hg.id as guardian_id,
    hg.household_id,
    hg.user_id,
    hg.is_primary,
    h.club_id,
    c.name as club_name
FROM household_guardians hg
LEFT JOIN households h ON hg.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
WHERE hg.user_id IN (
    SELECT id FROM profiles WHERE email = 'ottilieotto+jackson+parent+a@gmail.com'
);

-- 4. Check profiles.id vs auth.users.id mismatch
SELECT 
    'Profile vs Auth User ID Comparison' as check_type,
    p.id as profile_id,
    au.id as auth_user_id,
    p.email,
    CASE 
        WHEN p.id = au.id THEN 'MATCH ✅'
        ELSE 'MISMATCH ❌'
    END as id_status
FROM profiles p
FULL OUTER JOIN auth.users au ON p.email = au.email
WHERE p.email = 'ottilieotto+jackson+parent+a@gmail.com'
   OR au.email = 'ottilieotto+jackson+parent+a@gmail.com';

-- 5. Show all household_guardians entries (joining via profiles since household_guardians.user_id references profiles.id)
SELECT 
    'All Household Guardians' as check_type,
    hg.id,
    hg.household_id,
    hg.user_id,
    hg.is_primary,
    p.email as user_email,
    h.club_id,
    c.name as club_name
FROM household_guardians hg
LEFT JOIN profiles p ON hg.user_id = p.id
LEFT JOIN households h ON hg.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
ORDER BY c.name, p.email;
