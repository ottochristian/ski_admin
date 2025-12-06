-- Migration 02: Add Seasons Foundation
-- Run this AFTER migration 01 (clubs)
-- This adds season-scoped data management

-- Step 1: Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, name)
);

-- Step 2: Create default season for existing data
-- Extract season from sub_programs.season_start if available, or use current year
INSERT INTO seasons (club_id, name, start_date, end_date, is_current, status)
SELECT DISTINCT
  c.id,
  COALESCE(
    TO_CHAR(MIN(sp.season_start), 'YYYY') || '-' || TO_CHAR(MAX(sp.season_end), 'YY'),
    TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || TO_CHAR(CURRENT_DATE + INTERVAL '1 year', 'YY')
  ) as season_name,
  COALESCE(MIN(sp.season_start), CURRENT_DATE) as start_date,
  COALESCE(MAX(sp.season_end), CURRENT_DATE + INTERVAL '1 year') as end_date,
  true,
  'active'
FROM clubs c
LEFT JOIN sub_programs sp ON sp.club_id = c.id
WHERE c.slug = 'default'
GROUP BY c.id
ON CONFLICT (club_id, name) DO NOTHING;

-- Step 3: Add season_id to relevant tables
ALTER TABLE programs ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
ALTER TABLE sub_programs ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
ALTER TABLE races ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

-- Step 4: Backfill season_id
-- For programs: link to current season
-- For sub_programs: use season_start/season_end to match or create season
-- For registrations: use the 'season' text column if it exists, or default to current
DO $$
DECLARE
  default_season_id UUID;
  reg_season_text TEXT;
BEGIN
  -- Get the current season for the default club
  SELECT id INTO default_season_id 
  FROM seasons 
  WHERE club_id = (SELECT id FROM clubs WHERE slug = 'default')
    AND is_current = true 
  LIMIT 1;
  
  -- If no current season exists, create one
  IF default_season_id IS NULL THEN
    INSERT INTO seasons (club_id, name, start_date, end_date, is_current, status)
    VALUES (
      (SELECT id FROM clubs WHERE slug = 'default'),
      TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || TO_CHAR(CURRENT_DATE + INTERVAL '1 year', 'YY'),
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 year',
      true,
      'active'
    )
    RETURNING id INTO default_season_id;
  END IF;
  
  -- Backfill programs
  UPDATE programs SET season_id = default_season_id WHERE season_id IS NULL;
  
  -- Backfill sub_programs (try to match by season dates, otherwise use default)
  UPDATE sub_programs sp
  SET season_id = COALESCE(
    (SELECT s.id FROM seasons s 
     WHERE s.club_id = sp.club_id 
       AND s.start_date <= COALESCE(sp.season_start, CURRENT_DATE)
       AND s.end_date >= COALESCE(sp.season_end, CURRENT_DATE + INTERVAL '1 year')
     LIMIT 1),
    default_season_id
  )
  WHERE sp.season_id IS NULL;
  
  -- Backfill registrations
  -- Try to match by season text column (e.g., "2024-2025" or "2025-2026")
  -- If no match, use default season
  UPDATE registrations r
  SET season_id = COALESCE(
    (SELECT s.id FROM seasons s 
     WHERE s.club_id = r.club_id 
       AND s.name = r.season
     LIMIT 1),
    default_season_id
  )
  WHERE r.season_id IS NULL;
  
  -- Backfill races (use race_date to match season)
  UPDATE races r
  SET season_id = COALESCE(
    (SELECT s.id FROM seasons s 
     WHERE s.club_id = r.club_id 
       AND s.start_date <= r.race_date
       AND s.end_date >= r.race_date
     LIMIT 1),
    default_season_id
  )
  WHERE r.season_id IS NULL;
  
  -- Backfill messages
  UPDATE messages SET season_id = default_season_id WHERE season_id IS NULL;
END $$;

-- Step 5: Make season_id NOT NULL for programs and registrations
ALTER TABLE programs ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE registrations ALTER COLUMN season_id SET NOT NULL;

-- Step 6: Add indexes
CREATE INDEX IF NOT EXISTS idx_seasons_club_id ON seasons(club_id);
CREATE INDEX IF NOT EXISTS idx_seasons_is_current ON seasons(is_current);
CREATE INDEX IF NOT EXISTS idx_programs_season_id ON programs(season_id);
CREATE INDEX IF NOT EXISTS idx_sub_programs_season_id ON sub_programs(season_id);
CREATE INDEX IF NOT EXISTS idx_registrations_season_id ON registrations(season_id);
CREATE INDEX IF NOT EXISTS idx_races_season_id ON races(season_id);
CREATE INDEX IF NOT EXISTS idx_messages_season_id ON messages(season_id);

-- Verify migration
SELECT 
  'Seasons migration complete' as status,
  (SELECT COUNT(*) FROM seasons) as seasons_count,
  (SELECT COUNT(*) FROM programs WHERE season_id IS NOT NULL) as programs_with_season,
  (SELECT COUNT(*) FROM registrations WHERE season_id IS NOT NULL) as registrations_with_season;

