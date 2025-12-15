-- Copy programs and sub-programs from 2024-2025 to 2025-2026 season
-- For GTSSF club

-- 1. Verify seasons exist
SELECT 
  'Seasons Check' as check_type,
  s.id,
  s.name,
  s.is_current,
  c.name as club_name,
  COUNT(p.id) as program_count
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
WHERE c.slug = 'gtssf' 
  AND (s.name LIKE '%2024-2025%' OR s.name LIKE '%2025-2026%')
GROUP BY s.id, s.name, s.is_current, c.name
ORDER BY s.name;

-- 2. Get season IDs for GTSSF
DO $$ 
DECLARE
  gtssf_club_id uuid;
  old_season_id uuid;
  new_season_id uuid;
  old_program record;
  new_program_id uuid;
  old_subprogram record;
  new_subprogram_id uuid;
  old_group record;
BEGIN
  -- Get GTSSF club ID
  SELECT id INTO gtssf_club_id FROM clubs WHERE slug = 'gtssf';
  
  IF gtssf_club_id IS NULL THEN
    RAISE NOTICE 'GTSSF club not found';
    RETURN;
  END IF;

  -- Get old season (2024-2025)
  SELECT id INTO old_season_id 
  FROM seasons 
  WHERE club_id = gtssf_club_id 
    AND name LIKE '%2024-2025%'
  LIMIT 1;
  
  -- Get new season (2025-2026)
  SELECT id INTO new_season_id 
  FROM seasons 
  WHERE club_id = gtssf_club_id 
    AND name LIKE '%2025-2026%'
  LIMIT 1;
  
  IF old_season_id IS NULL THEN
    RAISE NOTICE 'Old season (2024-2025) not found';
    RETURN;
  END IF;
  
  IF new_season_id IS NULL THEN
    RAISE NOTICE 'New season (2025-2026) not found';
    RETURN;
  END IF;

  RAISE NOTICE 'Copying programs from % to %', old_season_id, new_season_id;

  -- Loop through programs in old season
  FOR old_program IN 
    SELECT * FROM programs 
    WHERE season_id = old_season_id 
      AND club_id = gtssf_club_id
  LOOP
    -- Create new program in new season
    INSERT INTO programs (
      name, 
      description, 
      status, 
      season_id, 
      club_id,
      created_at,
      updated_at
    ) VALUES (
      old_program.name,
      old_program.description,
      'ACTIVE', -- Set as ACTIVE so parents can see it
      new_season_id,
      gtssf_club_id,
      NOW(),
      NOW()
    ) RETURNING id INTO new_program_id;
    
    RAISE NOTICE 'Created program: % (ID: %)', old_program.name, new_program_id;

    -- Loop through sub-programs for this program
    FOR old_subprogram IN 
      SELECT * FROM sub_programs 
      WHERE program_id = old_program.id
    LOOP
      -- Create new sub-program in new season
      INSERT INTO sub_programs (
        program_id,
        name,
        description,
        status,
        registration_fee,
        max_capacity,
        season_id,
        club_id,
        created_at,
        updated_at
      ) VALUES (
        new_program_id,
        old_subprogram.name,
        old_subprogram.description,
        'ACTIVE', -- Set as ACTIVE so parents can register
        old_subprogram.registration_fee,
        old_subprogram.max_capacity,
        new_season_id,
        gtssf_club_id,
        NOW(),
        NOW()
      ) RETURNING id INTO new_subprogram_id;
      
      RAISE NOTICE '  Created sub-program: % (ID: %)', old_subprogram.name, new_subprogram_id;

      -- Loop through groups for this sub-program
      FOR old_group IN 
        SELECT * FROM groups 
        WHERE sub_program_id = old_subprogram.id
      LOOP
        -- Create new group
        INSERT INTO groups (
          sub_program_id,
          name,
          status,
          club_id,
          created_at,
          updated_at
        ) VALUES (
          new_subprogram_id,
          old_group.name,
          'ACTIVE',
          gtssf_club_id,
          NOW(),
          NOW()
        );
        
        RAISE NOTICE '    Created group: %', old_group.name;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Migration complete!';
END $$;

-- 3. Verify the copy
SELECT 
  'Verification' as check_type,
  s.name as season_name,
  COUNT(DISTINCT p.id) as programs,
  COUNT(DISTINCT sp.id) as sub_programs,
  COUNT(DISTINCT g.id) as groups
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
LEFT JOIN groups g ON g.sub_program_id = sp.id
WHERE c.slug = 'gtssf' 
  AND (s.name LIKE '%2024-2025%' OR s.name LIKE '%2025-2026%')
GROUP BY s.id, s.name
ORDER BY s.name;
