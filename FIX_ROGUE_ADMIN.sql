-- Fix rogue admin account that has 'parent' role
-- Option 1: Update role to 'admin'
-- Option 2: Delete the account (if it's not needed)

-- Show the rogue account
SELECT 
    'Rogue Account' as check_type,
    email,
    role,
    first_name,
    last_name
FROM profiles
WHERE email = 'ottilieotto+jackson+admin@gmail.com';

-- Fix: Update role to 'admin'
UPDATE profiles
SET role = 'admin'
WHERE email = 'ottilieotto+jackson+admin@gmail.com';

-- Verify
SELECT 
    'After Fix' as check_type,
    email,
    role,
    first_name,
    last_name,
    CASE 
        WHEN role = 'admin' THEN '✅ Fixed!'
        ELSE '❌ Still wrong'
    END as status
FROM profiles
WHERE email = 'ottilieotto+jackson+admin@gmail.com';
