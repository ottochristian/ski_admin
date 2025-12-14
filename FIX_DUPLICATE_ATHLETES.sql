-- Fix: Remove duplicate athlete records across ENTIRE athletes table
-- Keep only one unique athlete per (household_id, first_name, last_name, date_of_birth)

-- 1. Show ALL duplicate athletes across all clubs/households
SELECT 
    'Duplicate Athletes Found (All Clubs)' as check_type,
    c.name as club_name,
    p.email as parent_email,
    a.household_id,
    a.first_name,
    a.last_name,
    a.date_of_birth,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(a.id) as athlete_ids
FROM athletes a
LEFT JOIN households h ON a.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
LEFT JOIN household_guardians hg ON hg.household_id = h.id
LEFT JOIN profiles p ON hg.user_id = p.id
GROUP BY c.name, p.email, a.household_id, a.first_name, a.last_name, a.date_of_birth
HAVING COUNT(*) > 1
ORDER BY c.name, p.email, a.first_name, a.last_name;

-- 2. Delete duplicate athletes (keep only the oldest record based on created_at)
DELETE FROM athletes
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY household_id, first_name, last_name, date_of_birth 
                ORDER BY created_at ASC  -- Keep the oldest record
            ) as rn
        FROM athletes
    ) t
    WHERE rn > 1  -- Delete all except the first (oldest) record
);

-- 3. Show remaining athletes for Jackson Parent A
SELECT 
    'Athletes After Cleanup' as check_type,
    a.id,
    a.first_name,
    a.last_name,
    a.date_of_birth,
    a.household_id,
    h.club_id,
    c.name as club_name
FROM athletes a
LEFT JOIN households h ON a.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
WHERE a.household_id IN (
    SELECT hg.household_id
    FROM household_guardians hg
    JOIN profiles p ON hg.user_id = p.id
    WHERE p.email = 'ottilieotto+jackson+parent+a@gmail.com'
)
ORDER BY a.first_name, a.last_name;

-- 4. Summary: Show all athletes grouped by household
SELECT 
    'All Athletes Summary' as check_type,
    c.name as club_name,
    p.email as parent_email,
    COUNT(DISTINCT a.id) as unique_athlete_count,
    STRING_AGG(DISTINCT a.first_name || ' ' || a.last_name, ', ') as athletes
FROM household_guardians hg
JOIN profiles p ON hg.user_id = p.id
JOIN households h ON hg.household_id = h.id
LEFT JOIN clubs c ON h.club_id = c.id
LEFT JOIN athletes a ON a.household_id = h.id
GROUP BY c.name, p.email
ORDER BY c.name, p.email;
