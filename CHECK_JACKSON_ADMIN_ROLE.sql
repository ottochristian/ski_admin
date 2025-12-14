-- Check Jackson Admin account setup
-- Verify role is 'admin' and not 'parent'

-- 1. Check profile for Jackson admin
SELECT 
    'Jackson Admin Profile' as check_type,
    p.id as profile_id,
    p.email,
    p.role,
    p.first_name,
    p.last_name,
    p.club_id,
    c.name as club_name,
    c.slug as club_slug,
    CASE 
        WHEN p.role = 'admin' THEN '✅ Role is correct'
        WHEN p.role = 'parent' THEN '❌ Role is WRONG - should be admin'
        ELSE '❌ Unknown role'
    END as status
FROM profiles p
LEFT JOIN clubs c ON p.club_id = c.id
WHERE p.email = 'ottilieotto+jackson+admin+a@gmail.com';

-- 2. Fix: Update role to 'admin' if it's wrong
UPDATE profiles
SET role = 'admin'
WHERE email = 'ottilieotto+jackson+admin+a@gmail.com'
  AND role != 'admin';

-- 3. Verify the fix
SELECT 
    'After Fix' as check_type,
    p.email,
    p.role,
    c.name as club_name,
    CASE 
        WHEN p.role = 'admin' THEN '✅ Fixed!'
        ELSE '❌ Still wrong'
    END as status
FROM profiles p
LEFT JOIN clubs c ON p.club_id = c.id
WHERE p.email = 'ottilieotto+jackson+admin+a@gmail.com';

-- 4. Check all admin accounts
SELECT 
    'All Admin Accounts' as check_type,
    p.email,
    p.role,
    p.first_name,
    p.last_name,
    c.name as club_name,
    CASE 
        WHEN p.role = 'admin' THEN '✅ Correct'
        ELSE '❌ Wrong role: ' || p.role
    END as status
FROM profiles p
LEFT JOIN clubs c ON p.club_id = c.id
WHERE p.email LIKE '%admin%'
ORDER BY c.name, p.email;
