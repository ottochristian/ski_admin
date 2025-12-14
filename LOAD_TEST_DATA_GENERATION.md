# Load Test Data Generation - Best Practices

## 🎯 Lessons Learned from Test Data Issues

### Issues Encountered
1. **Multiple households per parent** - `.maybeSingle()` failures
2. **Cross-household duplicate athletes** - Same athlete in different households
3. **Missing household links** - Parents without `household_guardians` entries
4. **Orphaned athletes** - Athletes with NULL or invalid `household_id`
5. **Missing club_id** - Records without proper club assignment
6. **Duplicate programs/sub-programs** - Same name appearing multiple times

## 🏗️ Data Integrity Rules

### Core Relationships

```
clubs (1)
  ├─> profiles (N) [club_id NOT NULL]
  │   └─> household_guardians (N) [user_id = profiles.id]
  │       └─> households (1) [ONE household per parent]
  │           └─> athletes (N) [household_id NOT NULL]
  │
  ├─> seasons (N) [club_id NOT NULL, ONE is_current = true]
  │
  └─> programs (N) [club_id NOT NULL, season_id NOT NULL]
      └─> sub_programs (N) [program_id NOT NULL]
          └─> groups (N) [sub_program_id NOT NULL]
```

### Key Constraints

#### 1. One Household Per Parent
```sql
-- MUST: Each parent has EXACTLY ONE household
SELECT user_id, COUNT(DISTINCT household_id)
FROM household_guardians
GROUP BY user_id
HAVING COUNT(DISTINCT household_id) != 1  -- Should return 0 rows
```

#### 2. Unique Athletes Per Club
```sql
-- MUST: No duplicate athlete names within same club
SELECT club_id, first_name, last_name, date_of_birth, COUNT(*)
FROM athletes
GROUP BY club_id, first_name, last_name, date_of_birth
HAVING COUNT(*) > 1  -- Should return 0 rows
```

#### 3. All Athletes Have Valid Households
```sql
-- MUST: All athletes belong to valid households
SELECT COUNT(*)
FROM athletes a
LEFT JOIN households h ON a.household_id = h.id
WHERE a.household_id IS NULL 
   OR h.id IS NULL  -- Should return 0
```

#### 4. Household Club Matches Athlete Club
```sql
-- MUST: Athletes' club_id matches their household's club_id
SELECT COUNT(*)
FROM athletes a
JOIN households h ON a.household_id = h.id
WHERE a.club_id != h.club_id  -- Should return 0
```

## 📋 Load Test Data Generation Script

### Structure
1. **Create Clubs** (1-10 clubs)
2. **Create Seasons** (1 current + 2-3 historical per club)
3. **Create Admins** (1-2 per club)
4. **Create Coaches** (5-20 per club)
5. **Create Parents** (100-10,000 per club)
6. **Create Households** (ONE per parent, atomically)
7. **Link Parents to Households** (household_guardians)
8. **Create Athletes** (1-4 per household)
9. **Create Programs** (3-10 per club/season)
10. **Create Sub-Programs** (2-5 per program)
11. **Create Groups** (2-10 per sub-program)
12. **Assign Coaches** (to programs/sub-programs/groups)
13. **Create Registrations** (50-80% of athletes)
14. **Validate Data Integrity** ✅

### Atomic Operations

#### ✅ Correct: Create Parent + Household + Link (Atomic)
```sql
DO $$
DECLARE
    new_parent_id UUID;
    new_household_id UUID;
    club_id_var UUID := '<club_id>';
BEGIN
    -- 1. Create parent profile
    INSERT INTO profiles (id, email, role, club_id, first_name, last_name)
    VALUES (gen_random_uuid(), 'parent@example.com', 'parent', club_id_var, 'John', 'Doe')
    RETURNING id INTO new_parent_id;
    
    -- 2. Create household
    INSERT INTO households (club_id, created_at, updated_at)
    VALUES (club_id_var, NOW(), NOW())
    RETURNING id INTO new_household_id;
    
    -- 3. Link parent to household (CRITICAL!)
    INSERT INTO household_guardians (household_id, user_id, is_primary, created_at)
    VALUES (new_household_id, new_parent_id, true, NOW());
    
    -- 4. Create athletes for this household
    INSERT INTO athletes (household_id, club_id, first_name, last_name, date_of_birth)
    VALUES 
        (new_household_id, club_id_var, 'Child1', 'Doe', '2015-01-01'),
        (new_household_id, club_id_var, 'Child2', 'Doe', '2017-01-01');
END $$;
```

#### ❌ Wrong: Create Parent, Household Separately
```sql
-- DON'T DO THIS - Risk of missing links!
INSERT INTO profiles (...) VALUES (...);  -- Parent created
INSERT INTO households (...) VALUES (...);  -- Household created
-- Oops! Forgot household_guardians link! ❌
```

## 🛡️ Validation Checks

### Pre-Generation Checklist
- [ ] Target club(s) exist
- [ ] At least one season exists per club
- [ ] Season has `is_current = true`

### Post-Generation Validation
```sql
-- Run after data generation to ensure integrity

-- 1. Check: All parents have exactly 1 household
SELECT 
    'Parents with != 1 household' as check,
    COUNT(*) as issue_count
FROM (
    SELECT user_id, COUNT(DISTINCT household_id) as household_count
    FROM household_guardians hg
    JOIN profiles p ON hg.user_id = p.id
    WHERE p.role = 'parent'
    GROUP BY user_id
    HAVING COUNT(DISTINCT household_id) != 1
) subquery;
-- Expected: 0

-- 2. Check: All athletes have valid households
SELECT 
    'Athletes without valid household' as check,
    COUNT(*) as issue_count
FROM athletes a
LEFT JOIN households h ON a.household_id = h.id
WHERE a.household_id IS NULL OR h.id IS NULL;
-- Expected: 0

-- 3. Check: No duplicate athletes per club
SELECT 
    'Duplicate athletes' as check,
    COUNT(*) as issue_count
FROM (
    SELECT club_id, first_name, last_name, date_of_birth
    FROM athletes
    GROUP BY club_id, first_name, last_name, date_of_birth
    HAVING COUNT(*) > 1
) subquery;
-- Expected: 0

-- 4. Check: Athlete club matches household club
SELECT 
    'Athletes with club mismatch' as check,
    COUNT(*) as issue_count
FROM athletes a
JOIN households h ON a.household_id = h.id
WHERE a.club_id != h.club_id;
-- Expected: 0

-- 5. Check: All coaches have profile entries
SELECT 
    'Coaches without profiles' as check,
    COUNT(*) as issue_count
FROM coaches c
LEFT JOIN profiles p ON c.profile_id = p.id
WHERE p.id IS NULL;
-- Expected: 0

-- 6. Check: All profiles have club_id
SELECT 
    'Profiles without club_id' as check,
    COUNT(*) as issue_count
FROM profiles
WHERE club_id IS NULL;
-- Expected: 0
```

## 🔧 Load Test Generation Tool (Future)

### Recommended Approach: Node.js Script

```javascript
// scripts/generate-load-test-data.js
import { createClient } from '@supabase/supabase-js'

const CLUBS_COUNT = 5
const PARENTS_PER_CLUB = 1000
const ATHLETES_PER_HOUSEHOLD = [1, 2, 3, 4] // Random distribution

async function generateLoadTestData() {
  // 1. Create clubs
  const clubs = await createClubs(CLUBS_COUNT)
  
  // 2. For each club:
  for (const club of clubs) {
    // Create seasons
    await createSeasons(club.id, 3)
    
    // Create admins
    await createAdmins(club.id, 2)
    
    // Create coaches
    await createCoaches(club.id, 15)
    
    // Create programs
    const programs = await createPrograms(club.id, 8)
    
    // Create parents + households atomically
    await createParentsWithHouseholds(club.id, PARENTS_PER_CLUB)
  }
  
  // 3. Validate data integrity
  const validationErrors = await validateDataIntegrity()
  
  if (validationErrors.length > 0) {
    console.error('❌ Data validation failed:', validationErrors)
    throw new Error('Data integrity check failed')
  }
  
  console.log('✅ Load test data generated successfully!')
}

async function createParentsWithHouseholds(clubId, count) {
  for (let i = 0; i < count; i++) {
    // ATOMIC: Create parent + household + link in single transaction
    await supabase.rpc('create_parent_with_household', {
      p_club_id: clubId,
      p_email: `loadtest_parent_${i}@example.com`,
      p_first_name: `Parent${i}`,
      p_last_name: `Test`,
      p_athlete_count: randomChoice(ATHLETES_PER_HOUSEHOLD)
    })
  }
}
```

### Database Function (Atomic Parent Creation)

```sql
CREATE OR REPLACE FUNCTION create_parent_with_household(
    p_club_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_athlete_count INT
) RETURNS UUID AS $$
DECLARE
    v_parent_id UUID;
    v_household_id UUID;
    v_athlete_id UUID;
    i INT;
BEGIN
    -- 1. Create parent profile
    INSERT INTO profiles (email, role, club_id, first_name, last_name)
    VALUES (p_email, 'parent', p_club_id, p_first_name, p_last_name)
    RETURNING id INTO v_parent_id;
    
    -- 2. Create household
    INSERT INTO households (club_id, created_at, updated_at)
    VALUES (p_club_id, NOW(), NOW())
    RETURNING id INTO v_household_id;
    
    -- 3. Link parent to household
    INSERT INTO household_guardians (household_id, user_id, is_primary)
    VALUES (v_household_id, v_parent_id, true);
    
    -- 4. Create athletes
    FOR i IN 1..p_athlete_count LOOP
        INSERT INTO athletes (
            household_id, 
            club_id, 
            first_name, 
            last_name, 
            date_of_birth
        )
        VALUES (
            v_household_id,
            p_club_id,
            'Athlete' || i,
            p_last_name,
            NOW() - INTERVAL '10 years' + (i || ' years')::INTERVAL
        );
    END LOOP;
    
    RETURN v_household_id;
END;
$$ LANGUAGE plpgsql;
```

## 📊 Performance Considerations

### Batch Inserts
- Insert 100-500 records per transaction
- Use `COPY` for bulk data (millions of rows)
- Disable triggers during load (re-enable after)
- Consider temporary indexes during generation

### Example: Bulk Parent Creation
```sql
-- Disable triggers temporarily
ALTER TABLE profiles DISABLE TRIGGER ALL;
ALTER TABLE households DISABLE TRIGGER ALL;

-- Bulk insert (wrap in transaction)
BEGIN;
  -- Insert 10,000 parents...
  -- Insert 10,000 households...
  -- Insert 10,000 household_guardians...
COMMIT;

-- Re-enable triggers
ALTER TABLE profiles ENABLE TRIGGER ALL;
ALTER TABLE households ENABLE TRIGGER ALL;
```

## ✅ Summary

### DO's
- ✅ Create parent + household + link **atomically**
- ✅ Validate data integrity **after generation**
- ✅ Use database functions for complex insertions
- ✅ Test with small dataset first (100 records)
- ✅ Scale up gradually (1K → 10K → 100K)
- ✅ Use transactions for related inserts

### DON'Ts
- ❌ Create parents and households separately
- ❌ Skip validation checks
- ❌ Generate data without constraints
- ❌ Assume relationships will "just work"
- ❌ Skip testing with realistic data volumes

### Files to Create Before Load Testing
1. `scripts/generate-load-test-data.js` - Node.js generation script
2. `scripts/validate-data-integrity.sql` - Post-generation validation
3. `scripts/cleanup-load-test-data.sql` - Clean up script
4. `LOAD_TEST_README.md` - Usage instructions
