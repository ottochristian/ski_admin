-- Migration: Improve season constraints and clarify dual-flag design
-- 
-- DESIGN: We keep BOTH is_current and status for maximum flexibility
-- 
-- is_current: Which season is "active" in the UI (only ONE per club)
-- status: Lifecycle state (draft, active, closed, archived)
--
-- Use cases:
-- 1. Prepare next season: is_current=false, status='draft'
-- 2. Switch seasons mid-year: Just flip is_current flag
-- 3. Close registrations but keep visible: is_current=true, status='closed'
-- 4. Multiple active seasons: One is_current, others can be 'active' for late regs

-- Step 1: Add status column if it doesn't exist (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'seasons' AND column_name = 'status'
  ) THEN
    ALTER TABLE seasons ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Step 2: Update any NULL status values to 'active'
UPDATE seasons 
SET status = 'active' 
WHERE status IS NULL;

-- Step 3: Add check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'seasons_status_check'
  ) THEN
    ALTER TABLE seasons 
    ADD CONSTRAINT seasons_status_check 
    CHECK (status IN ('draft', 'active', 'closed', 'archived'));
  END IF;
END $$;

-- Step 4: Create unique constraint - only ONE current season per club
-- Drop old constraint if exists
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_one_current_per_club;

-- Create new unique partial index (better than constraint for conditional uniqueness)
DROP INDEX IF EXISTS idx_seasons_one_current_per_club;
CREATE UNIQUE INDEX idx_seasons_one_current_per_club 
ON seasons (club_id) 
WHERE is_current = true;

-- Step 5: Ensure each club has AT MOST one current season
-- If multiple, keep the most recent one
WITH ranked_current_seasons AS (
  SELECT 
    id,
    club_id,
    ROW_NUMBER() OVER (
      PARTITION BY club_id 
      ORDER BY start_date DESC, created_at DESC
    ) as rn
  FROM seasons
  WHERE is_current = true
)
UPDATE seasons
SET is_current = false
WHERE id IN (
  SELECT id FROM ranked_current_seasons WHERE rn > 1
);

-- Step 6: Add helpful comment
COMMENT ON COLUMN seasons.is_current IS 
'Boolean flag: only ONE season per club should have is_current=true. This is the season displayed by default in UI.';

COMMENT ON COLUMN seasons.status IS 
'Lifecycle state: draft (setup), active (open for registrations), closed (no new registrations), archived (historical/read-only)';

-- Step 7: Verification queries
SELECT 
  'Current Season Check' as check_type,
  c.name as club_name,
  COUNT(CASE WHEN s.is_current THEN 1 END) as current_season_count,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_season_count,
  COUNT(*) as total_seasons
FROM clubs c
LEFT JOIN seasons s ON s.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
