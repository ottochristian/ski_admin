-- Example: How to use the load test helper functions

-- ============================================================================
-- STEP 1: Generate Load Test Data
-- ============================================================================

-- Example: Create 100 parents with households atomically for Jackson club
DO $$
DECLARE
    jackson_club_id UUID;
    i INT;
    result RECORD;
BEGIN
    -- Get Jackson club ID
    SELECT id INTO jackson_club_id FROM clubs WHERE slug = 'jackson';
    
    -- Create 100 parents with households
    FOR i IN 1..100 LOOP
        SELECT * INTO result
        FROM create_parent_with_household(
            jackson_club_id,
            'loadtest_parent_' || i || '@example.com',
            'LoadTest',
            'Parent' || i,
            CASE WHEN i % 4 = 0 THEN 1  -- 25% have 1 child
                 WHEN i % 4 = 1 THEN 2  -- 25% have 2 children
                 WHEN i % 4 = 2 THEN 3  -- 25% have 3 children
                 ELSE 4                 -- 25% have 4 children
            END
        );
        
        IF i % 10 = 0 THEN
            RAISE NOTICE 'Created % parents...', i;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Created 100 parents with households and athletes';
END $$;

-- ============================================================================
-- STEP 2: Validate Data Integrity
-- ============================================================================

-- Check for any data integrity issues
SELECT * FROM validate_data_integrity()
WHERE issue_count > 0
ORDER BY 
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        ELSE 4
    END;

-- Expected: No rows (all checks pass)
-- If you see rows, there are integrity issues that need fixing!

-- ============================================================================
-- STEP 3: Get Statistics
-- ============================================================================

-- View data statistics
SELECT 
    category,
    metric,
    count
FROM get_data_statistics()
ORDER BY category, metric;

-- ============================================================================
-- STEP 4: Cleanup (if needed)
-- ============================================================================

-- Remove orphaned records
SELECT * FROM cleanup_orphaned_records();

-- ============================================================================
-- STEP 5: Validate Again (After Cleanup)
-- ============================================================================

-- Re-run validation to ensure cleanup worked
SELECT * FROM validate_data_integrity()
WHERE issue_count > 0;

-- Should return 0 rows if cleanup was successful

-- ============================================================================
-- EXAMPLE: Bulk Parent Creation with Transaction
-- ============================================================================

BEGIN;
    -- Create 1000 parents atomically
    DO $$
    DECLARE
        club_id_var UUID := (SELECT id FROM clubs WHERE slug = 'jackson');
        i INT;
    BEGIN
        FOR i IN 1..1000 LOOP
            PERFORM create_parent_with_household(
                club_id_var,
                'bulk_parent_' || i || '@example.com',
                'Bulk',
                'Parent' || i,
                FLOOR(RANDOM() * 4 + 1)::INT  -- Random 1-4 athletes
            );
        END LOOP;
    END $$;
    
    -- Validate before committing
    DO $$
    DECLARE
        issue_count INT;
    BEGIN
        SELECT COUNT(*) INTO issue_count
        FROM validate_data_integrity()
        WHERE issue_count > 0 AND severity IN ('CRITICAL', 'HIGH');
        
        IF issue_count > 0 THEN
            RAISE EXCEPTION 'Data validation failed with % issues', issue_count;
        END IF;
        
        RAISE NOTICE '✅ Validation passed - committing transaction';
    END $$;
COMMIT;

-- ============================================================================
-- CLEANUP: Remove Load Test Data
-- ============================================================================

-- Remove all load test data (be careful!)
-- Uncomment to run:

/*
DELETE FROM athletes WHERE household_id IN (
    SELECT hg.household_id
    FROM household_guardians hg
    JOIN profiles p ON hg.user_id = p.id
    WHERE p.email LIKE 'loadtest_%' OR p.email LIKE 'bulk_%'
);

DELETE FROM household_guardians WHERE user_id IN (
    SELECT id FROM profiles 
    WHERE email LIKE 'loadtest_%' OR email LIKE 'bulk_%'
);

DELETE FROM households WHERE id IN (
    SELECT household_id FROM household_guardians
    WHERE user_id IN (
        SELECT id FROM profiles 
        WHERE email LIKE 'loadtest_%' OR email LIKE 'bulk_%'
    )
);

DELETE FROM profiles 
WHERE email LIKE 'loadtest_%' OR email LIKE 'bulk_%';
*/

-- ============================================================================
-- PERFORMANCE TEST: Time the generation
-- ============================================================================

DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTERVAL;
    club_id_var UUID := (SELECT id FROM clubs WHERE slug = 'jackson');
    i INT;
BEGIN
    start_time := clock_timestamp();
    
    -- Create 100 parents
    FOR i IN 1..100 LOOP
        PERFORM create_parent_with_household(
            club_id_var,
            'perf_test_' || i || '@example.com',
            'Perf',
            'Test' || i,
            2  -- 2 athletes each
        );
    END LOOP;
    
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    RAISE NOTICE 'Created 100 parents with households in %', duration;
    RAISE NOTICE 'Average: % per parent', duration / 100;
END $$;
