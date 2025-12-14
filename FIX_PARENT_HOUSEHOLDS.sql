-- Fix missing households for Jackson and GTSSF parent test users
-- This script creates households and links them to the parent profiles

DO $$
DECLARE
  jackson_club_id UUID;
  gtssf_club_id UUID;
  jackson_parent_a_id UUID;
  jackson_parent_b_id UUID;
  gtssf_parent_a_id UUID;
  gtssf_parent_b_id UUID;
  jackson_household_a_id UUID;
  jackson_household_b_id UUID;
  gtssf_household_a_id UUID;
  gtssf_household_b_id UUID;
BEGIN
  -- Get club IDs
  SELECT id INTO jackson_club_id FROM clubs WHERE slug = 'jackson';
  SELECT id INTO gtssf_club_id FROM clubs WHERE slug = 'gtssf';

  -- Get parent profile IDs
  SELECT id INTO jackson_parent_a_id FROM profiles WHERE email = 'ottilieotto+jackson+parent+a@gmail.com';
  SELECT id INTO jackson_parent_b_id FROM profiles WHERE email = 'ottilieotto+jackson+parent+b@gmail.com';
  SELECT id INTO gtssf_parent_a_id FROM profiles WHERE email = 'ottilieotto+gtssf+parent+a@gmail.com';
  SELECT id INTO gtssf_parent_b_id FROM profiles WHERE email = 'ottilieotto+gtssf+parent+b@gmail.com';

  RAISE NOTICE 'Found club IDs: Jackson=%, GTSSF=%', jackson_club_id, gtssf_club_id;
  RAISE NOTICE 'Found parent IDs: Jackson A=%, Jackson B=%, GTSSF A=%, GTSSF B=%', 
    jackson_parent_a_id, jackson_parent_b_id, gtssf_parent_a_id, gtssf_parent_b_id;

  -- ============================================================================
  -- CREATE JACKSON HOUSEHOLDS
  -- ============================================================================
  
  -- Jackson Parent A household
  IF jackson_parent_a_id IS NOT NULL THEN
    -- Check if household already exists
    SELECT household_id INTO jackson_household_a_id
    FROM household_guardians
    WHERE user_id = jackson_parent_a_id
    LIMIT 1;

    IF jackson_household_a_id IS NULL THEN
      -- Create household
      INSERT INTO households (club_id, created_at, updated_at)
      VALUES (jackson_club_id, NOW(), NOW())
      RETURNING id INTO jackson_household_a_id;

      -- Link parent to household
      INSERT INTO household_guardians (household_id, user_id, created_at, updated_at)
      VALUES (jackson_household_a_id, jackson_parent_a_id, NOW(), NOW());

      RAISE NOTICE 'Created household for Jackson Parent A: %', jackson_household_a_id;
    ELSE
      RAISE NOTICE 'Jackson Parent A already has household: %', jackson_household_a_id;
    END IF;
  END IF;

  -- Jackson Parent B household
  IF jackson_parent_b_id IS NOT NULL THEN
    SELECT household_id INTO jackson_household_b_id
    FROM household_guardians
    WHERE user_id = jackson_parent_b_id
    LIMIT 1;

    IF jackson_household_b_id IS NULL THEN
      INSERT INTO households (club_id, created_at, updated_at)
      VALUES (jackson_club_id, NOW(), NOW())
      RETURNING id INTO jackson_household_b_id;

      INSERT INTO household_guardians (household_id, user_id, created_at, updated_at)
      VALUES (jackson_household_b_id, jackson_parent_b_id, NOW(), NOW());

      RAISE NOTICE 'Created household for Jackson Parent B: %', jackson_household_b_id;
    ELSE
      RAISE NOTICE 'Jackson Parent B already has household: %', jackson_household_b_id;
    END IF;
  END IF;

  -- ============================================================================
  -- CREATE GTSSF HOUSEHOLDS
  -- ============================================================================

  -- GTSSF Parent A household
  IF gtssf_parent_a_id IS NOT NULL THEN
    SELECT household_id INTO gtssf_household_a_id
    FROM household_guardians
    WHERE user_id = gtssf_parent_a_id
    LIMIT 1;

    IF gtssf_household_a_id IS NULL THEN
      INSERT INTO households (club_id, created_at, updated_at)
      VALUES (gtssf_club_id, NOW(), NOW())
      RETURNING id INTO gtssf_household_a_id;

      INSERT INTO household_guardians (household_id, user_id, created_at, updated_at)
      VALUES (gtssf_household_a_id, gtssf_parent_a_id, NOW(), NOW());

      RAISE NOTICE 'Created household for GTSSF Parent A: %', gtssf_household_a_id;
    ELSE
      RAISE NOTICE 'GTSSF Parent A already has household: %', gtssf_household_a_id;
    END IF;
  END IF;

  -- GTSSF Parent B household
  IF gtssf_parent_b_id IS NOT NULL THEN
    SELECT household_id INTO gtssf_household_b_id
    FROM household_guardians
    WHERE user_id = gtssf_parent_b_id
    LIMIT 1;

    IF gtssf_household_b_id IS NULL THEN
      INSERT INTO households (club_id, created_at, updated_at)
      VALUES (gtssf_club_id, NOW(), NOW())
      RETURNING id INTO gtssf_household_b_id;

      INSERT INTO household_guardians (household_id, user_id, created_at, updated_at)
      VALUES (gtssf_household_b_id, gtssf_parent_b_id, NOW(), NOW());

      RAISE NOTICE 'Created household for GTSSF Parent B: %', gtssf_household_b_id;
    ELSE
      RAISE NOTICE 'GTSSF Parent B already has household: %', gtssf_household_b_id;
    END IF;
  END IF;

  -- ============================================================================
  -- UPDATE ATHLETES TO LINK TO HOUSEHOLDS
  -- ============================================================================

  -- Link Jackson athletes to their parent households
  UPDATE athletes
  SET household_id = jackson_household_a_id
  WHERE club_id = jackson_club_id
    AND last_name LIKE 'Athlete A%'
    AND (household_id IS NULL OR household_id != jackson_household_a_id);

  UPDATE athletes
  SET household_id = jackson_household_b_id
  WHERE club_id = jackson_club_id
    AND last_name LIKE 'Athlete B%'
    AND (household_id IS NULL OR household_id != jackson_household_b_id);

  -- Link GTSSF athletes to their parent households
  UPDATE athletes
  SET household_id = gtssf_household_a_id
  WHERE club_id = gtssf_club_id
    AND last_name LIKE 'Athlete A%'
    AND (household_id IS NULL OR household_id != gtssf_household_a_id);

  UPDATE athletes
  SET household_id = gtssf_household_b_id
  WHERE club_id = gtssf_club_id
    AND last_name LIKE 'Athlete B%'
    AND (household_id IS NULL OR household_id != gtssf_household_b_id);

  RAISE NOTICE 'Linked athletes to their households';

END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show parent households
SELECT 
  'Parent Households' as check_type,
  p.email,
  p.first_name,
  p.last_name,
  c.name as club_name,
  h.id as household_id,
  (SELECT COUNT(*) FROM athletes WHERE household_id = h.id) as athlete_count
FROM profiles p
JOIN clubs c ON c.id = p.club_id
LEFT JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN households h ON h.id = hg.household_id
WHERE p.email IN (
  'ottilieotto+jackson+parent+a@gmail.com',
  'ottilieotto+jackson+parent+b@gmail.com',
  'ottilieotto+gtssf+parent+a@gmail.com',
  'ottilieotto+gtssf+parent+b@gmail.com'
)
ORDER BY c.name, p.email;

-- Show athletes per household
SELECT 
  'Athletes per Household' as check_type,
  h.id as household_id,
  c.name as club_name,
  p.email as parent_email,
  a.first_name as athlete_first_name,
  a.last_name as athlete_last_name,
  a.date_of_birth
FROM households h
JOIN clubs c ON c.id = h.club_id
JOIN household_guardians hg ON hg.household_id = h.id
JOIN profiles p ON p.id = hg.user_id
LEFT JOIN athletes a ON a.household_id = h.id
WHERE p.email IN (
  'ottilieotto+jackson+parent+a@gmail.com',
  'ottilieotto+jackson+parent+b@gmail.com',
  'ottilieotto+gtssf+parent+a@gmail.com',
  'ottilieotto+gtssf+parent+b@gmail.com'
)
ORDER BY c.name, p.email, a.last_name;
