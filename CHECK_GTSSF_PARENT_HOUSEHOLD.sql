-- Check GTSSF Parent A household setup

-- 1. Check profile
SELECT 
    'GTSSF Parent A Profile' as check_type,
    id,
    email,
    role,
    club_id
FROM profiles
WHERE email = 'ottilieotto+gtssf+parent+a@gmail.com';

-- 2. Check household_guardians entries
SELECT 
    'Household Guardians' as check_type,
    hg.id,
    hg.household_id,
    hg.user_id,
    h.club_id,
    c.name as club_name,
    COUNT(a.id) as athlete_count
FROM household_guardians hg
LEFT JOIN households h ON hg.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
LEFT JOIN athletes a ON a.household_id = h.id
WHERE hg.user_id = (SELECT id FROM profiles WHERE email = 'ottilieotto+gtssf+parent+a@gmail.com')
GROUP BY hg.id, hg.household_id, hg.user_id, h.club_id, c.name;

-- 3. Check if multiple households exist
SELECT 
    'Multiple Households Check' as check_type,
    COUNT(*) as household_count
FROM household_guardians
WHERE user_id = (SELECT id FROM profiles WHERE email = 'ottilieotto+gtssf+parent+a@gmail.com');

-- 4. Check athletes for this parent
SELECT 
    'Athletes' as check_type,
    a.id,
    a.first_name,
    a.last_name,
    a.household_id,
    h.club_id,
    c.name as club_name
FROM athletes a
LEFT JOIN households h ON a.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
WHERE a.household_id IN (
    SELECT household_id
    FROM household_guardians
    WHERE user_id = (SELECT id FROM profiles WHERE email = 'ottilieotto+gtssf+parent+a@gmail.com')
);
