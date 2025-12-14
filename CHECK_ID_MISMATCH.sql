-- Simple check: Does profiles.id match auth.users.id for Jackson Parent A?
-- This is the root cause of the household lookup failure

SELECT 
    'ID Comparison for Jackson Parent A' as check_type,
    p.id as profile_id,
    au.id as auth_user_id,
    p.email,
    CASE 
        WHEN p.id = au.id THEN '✅ MATCH - IDs are the same'
        ELSE '❌ MISMATCH - This is the problem!'
    END as status,
    hg.household_id as household_linked_to_profile_id,
    CASE
        WHEN hg.household_id IS NOT NULL THEN '✅ household_guardians has entry'
        ELSE '❌ No household_guardians entry'
    END as household_status
FROM profiles p
LEFT JOIN auth.users au ON p.email = au.email
LEFT JOIN household_guardians hg ON hg.user_id = p.id
WHERE p.email = 'ottilieotto+jackson+parent+a@gmail.com';
