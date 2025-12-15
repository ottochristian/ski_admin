-- Alternative: Copy Alpine + Nordic from "2025-2026" to "2025-2026 v2"
-- Use this if you want to keep "2025-2026 v2" as current

DO $$ 
DECLARE
  gtssf_club_id uuid;
  source_season_id uuid;
  target_season_id uuid;
  old_program record;
  new_program_id uuid;
  old_subprogram record;
  new_subprogram_id uuid;
  old_group record;
BEGIN
  -- Get GTSSF club ID
  SELECT id INTO gtssf_club_id FROM clubs WHERE slug = 'gtssf';
  
  -- Get source season (2025-2026 with Alpine + Nordic)
  SELECT id INTO source_season_id 
  FROM seasons 
  WHERE club_id = gtssf_club_id 
    AND name = '2025-2026'
  LIMIT 1;
  
  -- Get target season (2025-2026 v2 - the current one)
  SELECT id INTO target_season_id 
  FROM seasons 
  WHERE club_id = gtssf_club_id 
    AND name = '2025-2026 v2'
  LIMIT 1;
  
  RAISE NOTICE 'Copying Alpine + Nordic from % to %', source_season_id, target_season_id;

  -- Loop through Alpine and Nordic programs only
  FOR old_program IN 
    SELECT * FROM programs 
    WHERE season_id = source_season_id 
      AND club_id = gtssf_club_id
      AND name IN ('Alpine Skiing', 'Nordic Skiing')
  LOOP
    -- Create new program in target season
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
      'ACTIVE',
      target_season_id,
      gtssf_club_id,
      NOW(),
      NOW()
    ) RETURNING id INTO new_program_id;
    
    RAISE NOTICE 'Created program: % (ID: %)', old_program.name, new_program_id;

    -- Loop through sub-programs
    FOR old_subprogram IN 
      SELECT * FROM sub_programs 
      WHERE program_id = old_program.id
    LOOP
      -- Create new sub-program
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
        'ACTIVE',
        old_subprogram.registration_fee,
        old_subprogram.max_capacity,
        target_season_id,
        gtssf_club_id,
        NOW(),
        NOW()
      ) RETURNING id INTO new_subprogram_id;
      
      RAISE NOTICE '  Created sub-program: % (ID: %)', old_subprogram.name, new_subprogram_id;

      -- Copy groups
      FOR old_group IN 
        SELECT * FROM groups 
        WHERE sub_program_id = old_subprogram.id
      LOOP
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

  RAISE NOTICE 'Copy complete!';
END $$;

-- Verify the copy
SELECT 
  'Verification' as check_type,
  s.name as season_name,
  s.is_current,
  COUNT(DISTINCT p.id) as programs,
  STRING_AGG(DISTINCT p.name, ', ') as program_names,
  COUNT(DISTINCT sp.id) as sub_programs
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id AND p.status = 'ACTIVE'
LEFT JOIN sub_programs sp ON sp.program_id = p.id AND sp.status = 'ACTIVE'
WHERE c.slug = 'gtssf' 
  AND s.name = '2025-2026 v2'
GROUP BY s.id, s.name, s.is_current;
