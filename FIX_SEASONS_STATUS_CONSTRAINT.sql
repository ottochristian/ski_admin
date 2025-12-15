-- Quick fix: Update seasons status constraint to include 'closed'
-- This allows the UI "Close" button to work

-- Step 1: Check current constraint
SELECT 
  'Current Constraint' as check_type,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'seasons_status_check';

-- Step 2: Drop old constraint if it exists
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_status_check;

-- Step 3: Add new constraint with all 4 valid values
ALTER TABLE seasons 
ADD CONSTRAINT seasons_status_check 
CHECK (status IN ('draft', 'active', 'closed', 'archived'));

-- Step 4: Verify new constraint
SELECT 
  'New Constraint' as check_type,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'seasons_status_check';

-- Step 5: Show all current season statuses
SELECT 
  'Current Season Statuses' as check_type,
  c.name as club_name,
  s.name as season_name,
  s.status,
  s.is_current
FROM seasons s
JOIN clubs c ON s.club_id = c.id
ORDER BY c.name, s.start_date DESC;
