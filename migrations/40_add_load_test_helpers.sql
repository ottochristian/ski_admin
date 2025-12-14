-- Migration 40: Add helper functions for load test data generation
-- These functions ensure atomic creation of related records to prevent data integrity issues

-- Function: Create parent with household atomically
-- This ensures every parent always has exactly ONE household
CREATE OR REPLACE FUNCTION create_parent_with_household(
    p_club_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_athlete_count INT DEFAULT 2
) RETURNS TABLE (
    parent_id UUID,
    household_id UUID,
    athlete_ids UUID[]
) AS $$
DECLARE
    v_parent_id UUID;
    v_household_id UUID;
    v_athlete_ids UUID[] := ARRAY[]::UUID[];
    v_athlete_id UUID;
    i INT;
BEGIN
    -- 1. Create parent profile (explicitly generate UUID)
    INSERT INTO profiles (id, email, role, club_id, first_name, last_name, created_at, updated_at)
    VALUES (gen_random_uuid(), p_email, 'parent', p_club_id, p_first_name, p_last_name, NOW(), NOW())
    RETURNING id INTO v_parent_id;
    
    -- 2. Create household
    INSERT INTO households (club_id, created_at, updated_at)
    VALUES (p_club_id, NOW(), NOW())
    RETURNING id INTO v_household_id;
    
    -- 3. Link parent to household (CRITICAL!)
    INSERT INTO household_guardians (household_id, user_id, is_primary, created_at)
    VALUES (v_household_id, v_parent_id, true, NOW());
    
    -- 4. Create athletes for this household
    FOR i IN 1..p_athlete_count LOOP
        INSERT INTO athletes (
            household_id, 
            club_id, 
            first_name, 
            last_name, 
            date_of_birth,
            created_at,
            updated_at
        )
        VALUES (
            v_household_id,
            p_club_id,
            'Child' || i,
            p_last_name,
            CURRENT_DATE - INTERVAL '8 years' + (i || ' years')::INTERVAL,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_athlete_id;
        
        v_athlete_ids := array_append(v_athlete_ids, v_athlete_id);
    END LOOP;
    
    -- Return all created IDs
    RETURN QUERY SELECT v_parent_id, v_household_id, v_athlete_ids;
END;
$$ LANGUAGE plpgsql;

-- Function: Validate data integrity
-- Returns issues found in the database
CREATE OR REPLACE FUNCTION validate_data_integrity()
RETURNS TABLE (
    check_name TEXT,
    issue_count BIGINT,
    severity TEXT,
    description TEXT
) AS $$
BEGIN
    -- Check 1: Parents with != 1 household
    RETURN QUERY
    SELECT 
        'parents_household_count'::TEXT as check_name,
        COUNT(*)::BIGINT as issue_count,
        'CRITICAL'::TEXT as severity,
        'Parents must have exactly 1 household'::TEXT as description
    FROM (
        SELECT user_id
        FROM household_guardians hg
        JOIN profiles p ON hg.user_id = p.id
        WHERE p.role = 'parent'
        GROUP BY user_id
        HAVING COUNT(DISTINCT household_id) != 1
    ) subquery;
    
    -- Check 2: Athletes without valid households
    RETURN QUERY
    SELECT 
        'athletes_invalid_household'::TEXT,
        COUNT(*)::BIGINT,
        'CRITICAL'::TEXT,
        'All athletes must belong to a valid household'::TEXT
    FROM athletes a
    LEFT JOIN households h ON a.household_id = h.id
    WHERE a.household_id IS NULL OR h.id IS NULL;
    
    -- Check 3: Duplicate athletes
    RETURN QUERY
    SELECT 
        'duplicate_athletes'::TEXT,
        COUNT(*)::BIGINT,
        'HIGH'::TEXT,
        'No duplicate athlete names within same club'::TEXT
    FROM (
        SELECT club_id, first_name, last_name, date_of_birth
        FROM athletes
        GROUP BY club_id, first_name, last_name, date_of_birth
        HAVING COUNT(*) > 1
    ) subquery;
    
    -- Check 4: Athlete/household club mismatch
    RETURN QUERY
    SELECT 
        'athlete_household_club_mismatch'::TEXT,
        COUNT(*)::BIGINT,
        'CRITICAL'::TEXT,
        'Athlete club_id must match household club_id'::TEXT
    FROM athletes a
    JOIN households h ON a.household_id = h.id
    WHERE a.club_id != h.club_id;
    
    -- Check 5: Coaches without profiles
    RETURN QUERY
    SELECT 
        'coaches_without_profiles'::TEXT,
        COUNT(*)::BIGINT,
        'CRITICAL'::TEXT,
        'All coaches must have a profile entry'::TEXT
    FROM coaches c
    LEFT JOIN profiles p ON c.profile_id = p.id
    WHERE p.id IS NULL;
    
    -- Check 6: Profiles without club_id
    RETURN QUERY
    SELECT 
        'profiles_without_club'::TEXT,
        COUNT(*)::BIGINT,
        'CRITICAL'::TEXT,
        'All profiles must have a club_id'::TEXT
    FROM profiles
    WHERE club_id IS NULL;
    
    -- Check 7: Seasons without current flag per club
    RETURN QUERY
    SELECT 
        'clubs_without_current_season'::TEXT,
        COUNT(*)::BIGINT,
        'HIGH'::TEXT,
        'Each club should have one current season'::TEXT
    FROM clubs c
    WHERE NOT EXISTS (
        SELECT 1 FROM seasons s 
        WHERE s.club_id = c.id 
        AND s.is_current = true
    );
    
    -- Check 8: Multiple current seasons per club
    RETURN QUERY
    SELECT 
        'multiple_current_seasons'::TEXT,
        COUNT(*)::BIGINT,
        'HIGH'::TEXT,
        'Each club should have only ONE current season'::TEXT
    FROM (
        SELECT club_id
        FROM seasons
        WHERE is_current = true
        GROUP BY club_id
        HAVING COUNT(*) > 1
    ) subquery;
END;
$$ LANGUAGE plpgsql;

-- Function: Clean up orphaned records
-- Safely removes records that don't have proper relationships
CREATE OR REPLACE FUNCTION cleanup_orphaned_records()
RETURNS TABLE (
    cleanup_type TEXT,
    records_deleted BIGINT
) AS $$
DECLARE
    v_deleted_count BIGINT;
BEGIN
    -- 1. Delete empty households (no guardians, no athletes)
    DELETE FROM households h
    WHERE NOT EXISTS (
        SELECT 1 FROM household_guardians hg WHERE hg.household_id = h.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM athletes a WHERE a.household_id = h.id
    );
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'empty_households'::TEXT, v_deleted_count;
    
    -- 2. Delete household_guardians without valid users
    DELETE FROM household_guardians hg
    WHERE NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = hg.user_id
    );
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'guardians_invalid_users'::TEXT, v_deleted_count;
    
    -- 3. Delete household_guardians without valid households
    DELETE FROM household_guardians hg
    WHERE NOT EXISTS (
        SELECT 1 FROM households h WHERE h.id = hg.household_id
    );
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'guardians_invalid_households'::TEXT, v_deleted_count;
    
    -- 4. Delete athletes without valid households
    -- (Be careful with this - might want to reassign instead)
    DELETE FROM athletes a
    WHERE household_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM households h WHERE h.id = a.household_id
    );
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'athletes_invalid_households'::TEXT, v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get data generation statistics
-- Useful for monitoring load test data
CREATE OR REPLACE FUNCTION get_data_statistics()
RETURNS TABLE (
    metric TEXT,
    count BIGINT,
    category TEXT
) AS $$
BEGIN
    -- Clubs
    RETURN QUERY SELECT 'clubs'::TEXT, COUNT(*)::BIGINT, 'core'::TEXT FROM clubs;
    
    -- Seasons
    RETURN QUERY SELECT 'seasons'::TEXT, COUNT(*)::BIGINT, 'core'::TEXT FROM seasons;
    RETURN QUERY SELECT 'current_seasons'::TEXT, COUNT(*)::BIGINT, 'core'::TEXT FROM seasons WHERE is_current = true;
    
    -- Users by role
    RETURN QUERY SELECT 'admins'::TEXT, COUNT(*)::BIGINT, 'users'::TEXT FROM profiles WHERE role = 'admin';
    RETURN QUERY SELECT 'coaches'::TEXT, COUNT(*)::BIGINT, 'users'::TEXT FROM profiles WHERE role = 'coach';
    RETURN QUERY SELECT 'parents'::TEXT, COUNT(*)::BIGINT, 'users'::TEXT FROM profiles WHERE role = 'parent';
    
    -- Households
    RETURN QUERY SELECT 'households'::TEXT, COUNT(*)::BIGINT, 'family'::TEXT FROM households;
    RETURN QUERY SELECT 'household_guardians'::TEXT, COUNT(*)::BIGINT, 'family'::TEXT FROM household_guardians;
    RETURN QUERY SELECT 'athletes'::TEXT, COUNT(*)::BIGINT, 'family'::TEXT FROM athletes;
    
    -- Programs
    RETURN QUERY SELECT 'programs'::TEXT, COUNT(*)::BIGINT, 'programs'::TEXT FROM programs;
    RETURN QUERY SELECT 'sub_programs'::TEXT, COUNT(*)::BIGINT, 'programs'::TEXT FROM sub_programs;
    RETURN QUERY SELECT 'groups'::TEXT, COUNT(*)::BIGINT, 'programs'::TEXT FROM groups;
    
    -- Registrations
    RETURN QUERY SELECT 'registrations'::TEXT, COUNT(*)::BIGINT, 'activity'::TEXT FROM registrations;
    RETURN QUERY SELECT 'orders'::TEXT, COUNT(*)::BIGINT, 'activity'::TEXT FROM orders;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION create_parent_with_household IS 'Atomically creates a parent profile, household, and athletes to ensure data integrity';
COMMENT ON FUNCTION validate_data_integrity IS 'Validates database relationships and returns any issues found';
COMMENT ON FUNCTION cleanup_orphaned_records IS 'Safely removes records without proper relationships';
COMMENT ON FUNCTION get_data_statistics IS 'Returns counts of all major entities for monitoring';
