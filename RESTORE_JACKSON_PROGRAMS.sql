-- Restore programs for Jackson if they were deleted
-- Only creates programs if Jackson has 0 programs

DO $$
DECLARE
  jackson_club_id UUID;
  jackson_season_id UUID;
  jackson_program_count INT;
BEGIN
  -- Get Jackson club ID
  SELECT id INTO jackson_club_id
  FROM clubs
  WHERE slug = 'jackson';

  -- Get Jackson's current season
  SELECT id INTO jackson_season_id
  FROM seasons
  WHERE club_id = jackson_club_id
    AND is_current = true
  LIMIT 1;

  -- Count Jackson's programs
  SELECT COUNT(*) INTO jackson_program_count
  FROM programs
  WHERE club_id = jackson_club_id;

  -- Only restore if Jackson has no programs
  IF jackson_program_count = 0 THEN
    RAISE NOTICE 'Jackson has no programs - creating default programs';

    -- Create Alpine Skiing program
    INSERT INTO programs (club_id, season_id, name, description, status)
    VALUES (
      jackson_club_id,
      jackson_season_id,
      'Alpine Skiing',
      'Traditional downhill skiing program',
      'ACTIVE'
    );

    -- Create Nordic Skiing program
    INSERT INTO programs (club_id, season_id, name, description, status)
    VALUES (
      jackson_club_id,
      jackson_season_id,
      'Nordic Skiing',
      'Cross-country skiing program',
      'ACTIVE'
    );

    -- Create Freestyle Skiing program
    INSERT INTO programs (club_id, season_id, name, description, status)
    VALUES (
      jackson_club_id,
      jackson_season_id,
      'Freestyle Skiing',
      'Moguls and terrain park skiing',
      'ACTIVE'
    );

    RAISE NOTICE 'Created 3 programs for Jackson club';
  ELSE
    RAISE NOTICE 'Jackson already has % program(s) - no restoration needed', jackson_program_count;
  END IF;
END $$;

-- Verify Jackson's programs
SELECT 
  'Jackson Programs After Restore' as check_type,
  p.id,
  p.name,
  p.description,
  p.status
FROM programs p
JOIN clubs c ON c.id = p.club_id
WHERE c.slug = 'jackson'
ORDER BY p.name;
