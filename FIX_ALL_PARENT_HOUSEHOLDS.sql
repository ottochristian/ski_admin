-- Fix ALL parent households - ensures every parent user has exactly ONE household

DO $$
DECLARE
    parent_record RECORD;
    household_count INT;
    primary_household_id UUID;
BEGIN
    -- Loop through all parent profiles
    FOR parent_record IN
        SELECT 
            p.id as profile_id,
            p.email,
            p.club_id,
            c.name as club_name
        FROM profiles p
        JOIN clubs c ON p.club_id = c.id
        WHERE p.role = 'parent'
        ORDER BY c.name, p.email
    LOOP
        -- Count households for this parent
        SELECT COUNT(DISTINCT household_id)
        INTO household_count
        FROM household_guardians
        WHERE user_id = parent_record.profile_id;
        
        RAISE NOTICE 'Parent: % (%) - Current households: %', 
            parent_record.email, parent_record.club_name, household_count;
        
        IF household_count = 0 THEN
            -- No household - create one
            INSERT INTO households (club_id, created_at, updated_at)
            VALUES (parent_record.club_id, NOW(), NOW())
            RETURNING id INTO primary_household_id;
            
            -- Link parent to household
            INSERT INTO household_guardians (household_id, user_id, is_primary, created_at)
            VALUES (primary_household_id, parent_record.profile_id, true, NOW());
            
            RAISE NOTICE '  ✅ Created household: %', primary_household_id;
            
        ELSIF household_count > 1 THEN
            -- Multiple households - keep the one with most athletes, delete others
            -- Find household with most athletes
            SELECT hg.household_id
            INTO primary_household_id
            FROM household_guardians hg
            LEFT JOIN athletes a ON a.household_id = hg.household_id
            WHERE hg.user_id = parent_record.profile_id
            GROUP BY hg.household_id
            ORDER BY COUNT(a.id) DESC, MIN(hg.created_at) ASC
            LIMIT 1;
            
            -- Delete other household_guardians entries
            DELETE FROM household_guardians
            WHERE user_id = parent_record.profile_id
              AND household_id != primary_household_id;
            
            -- Delete empty households
            DELETE FROM households h
            WHERE h.club_id = parent_record.club_id
              AND NOT EXISTS (
                  SELECT 1 FROM household_guardians hg 
                  WHERE hg.household_id = h.id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM athletes a 
                  WHERE a.household_id = h.id
              );
            
            RAISE NOTICE '  ✅ Kept primary household: % (deleted %)', 
                primary_household_id, household_count - 1;
        ELSE
            -- Exactly 1 household - perfect!
            SELECT household_id INTO primary_household_id
            FROM household_guardians
            WHERE user_id = parent_record.profile_id
            LIMIT 1;
            
            RAISE NOTICE '  ✅ Already has 1 household: %', primary_household_id;
        END IF;
        
        -- Ensure all orphaned athletes for this club are linked to this household
        UPDATE athletes
        SET household_id = primary_household_id
        WHERE club_id = parent_record.club_id
          AND (household_id IS NULL OR household_id NOT IN (
              SELECT household_id FROM household_guardians
          ))
          -- Only link athletes that match parent's naming pattern (optional safety check)
          AND first_name = (SELECT name FROM clubs WHERE id = parent_record.club_id);
          
    END LOOP;
    
    RAISE NOTICE '✅ Finished fixing all parent households!';
END $$;

-- Verification: Show all parents with their household counts
SELECT 
    'Final Verification' as check_type,
    c.name as club_name,
    p.email as parent_email,
    COUNT(DISTINCT hg.household_id) as household_count,
    COUNT(DISTINCT a.id) as athlete_count,
    (ARRAY_AGG(hg.household_id))[1] as household_id
FROM profiles p
JOIN clubs c ON p.club_id = c.id
LEFT JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN athletes a ON a.household_id = hg.household_id
WHERE p.role = 'parent'
GROUP BY c.name, p.email
ORDER BY c.name, p.email;
