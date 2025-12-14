-- Find and fix athletes with same name across different households in the same club
-- These are TRUE duplicates that shouldn't exist

-- 1. Find athletes with same first_name + last_name + DOB in the same club but different households
SELECT 
    'Cross-Household Duplicates' as check_type,
    c.name as club_name,
    a.first_name,
    a.last_name,
    a.date_of_birth,
    COUNT(DISTINCT a.id) as duplicate_count,
    COUNT(DISTINCT a.household_id) as different_households,
    ARRAY_AGG(DISTINCT a.id) as athlete_ids,
    ARRAY_AGG(DISTINCT a.household_id) as household_ids
FROM athletes a
LEFT JOIN clubs c ON a.club_id = c.id
GROUP BY c.name, a.first_name, a.last_name, a.date_of_birth, a.club_id
HAVING COUNT(DISTINCT a.id) > 1  -- Same name appears multiple times
ORDER BY c.name, a.first_name, a.last_name;

-- 2. Delete cross-household duplicates (keep the first created record)
DELETE FROM athletes
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY club_id, first_name, last_name, date_of_birth
                ORDER BY created_at ASC  -- Keep the oldest record
            ) as rn
        FROM athletes
    ) t
    WHERE rn > 1  -- Delete all except the first (oldest) record per name per club
);

-- 3. Verify: Show all athletes by club after cleanup
SELECT 
    'Athletes After Cross-Household Cleanup' as check_type,
    c.name as club_name,
    a.first_name,
    a.last_name,
    a.date_of_birth,
    a.household_id,
    h_parent.email as parent_email
FROM athletes a
LEFT JOIN clubs c ON a.club_id = c.id
LEFT JOIN household_guardians hg ON hg.household_id = a.household_id
LEFT JOIN profiles h_parent ON hg.user_id = h_parent.id
ORDER BY c.name, a.first_name, a.last_name;

-- 4. Summary: Count athletes per club
SELECT 
    'Final Athlete Count' as check_type,
    c.name as club_name,
    COUNT(DISTINCT a.id) as total_unique_athletes
FROM athletes a
LEFT JOIN clubs c ON a.club_id = c.id
GROUP BY c.name
ORDER BY c.name;
