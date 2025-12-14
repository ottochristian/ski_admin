-- Fix: Delete duplicate/empty households for Jackson Parent A
-- Keep only the household with athletes

-- 1. Show current households for Jackson Parent A
SELECT 
    'Current Households' as check_type,
    hg.household_id,
    h.club_id,
    c.name as club_name,
    COUNT(a.id) as athlete_count
FROM household_guardians hg
LEFT JOIN households h ON hg.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
LEFT JOIN athletes a ON a.household_id = h.id
WHERE hg.user_id = (SELECT id FROM profiles WHERE email = 'ottilieotto+jackson+parent+a@gmail.com')
GROUP BY hg.household_id, h.club_id, c.name;

-- 2. Delete empty households (households with 0 athletes)
DELETE FROM household_guardians
WHERE household_id IN (
    SELECT h.id
    FROM households h
    LEFT JOIN athletes a ON a.household_id = h.id
    WHERE h.id IN (
        SELECT hg.household_id
        FROM household_guardians hg
        WHERE hg.user_id = (SELECT id FROM profiles WHERE email = 'ottilieotto+jackson+parent+a@gmail.com')
    )
    GROUP BY h.id
    HAVING COUNT(a.id) = 0
);

DELETE FROM households
WHERE id IN (
    SELECT h.id
    FROM households h
    LEFT JOIN athletes a ON a.household_id = h.id
    WHERE h.id IN (
        SELECT hg.household_id
        FROM household_guardians hg
        WHERE hg.user_id = (SELECT id FROM profiles WHERE email = 'ottilieotto+jackson+parent+a@gmail.com')
    )
    GROUP BY h.id
    HAVING COUNT(a.id) = 0
);

-- 3. Verify - should now show only 1 household
SELECT 
    'After Cleanup' as check_type,
    hg.household_id,
    h.club_id,
    c.name as club_name,
    COUNT(a.id) as athlete_count
FROM household_guardians hg
LEFT JOIN households h ON hg.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
LEFT JOIN athletes a ON a.household_id = h.id
WHERE hg.user_id = (SELECT id FROM profiles WHERE email = 'ottilieotto+jackson+parent+a@gmail.com')
GROUP BY hg.household_id, h.club_id, c.name;

-- 4. Also clean up for all other parents
DELETE FROM household_guardians
WHERE household_id IN (
    SELECT h.id
    FROM households h
    LEFT JOIN athletes a ON a.household_id = h.id
    GROUP BY h.id
    HAVING COUNT(a.id) = 0
);

DELETE FROM households
WHERE id IN (
    SELECT h.id
    FROM households h
    LEFT JOIN athletes a ON a.household_id = h.id
    GROUP BY h.id
    HAVING COUNT(a.id) = 0
);

-- 5. Final verification - show all households with athlete counts
SELECT 
    'All Households Summary' as check_type,
    c.name as club_name,
    p.email as parent_email,
    hg.household_id,
    COUNT(a.id) as athlete_count
FROM household_guardians hg
LEFT JOIN profiles p ON hg.user_id = p.id
LEFT JOIN households h ON hg.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
LEFT JOIN athletes a ON a.household_id = h.id
GROUP BY c.name, p.email, hg.household_id
ORDER BY c.name, p.email;
