-- Migration 05: Cleanup Old Columns (OPTIONAL - Run after verifying everything works)
-- This removes old columns that have been migrated
-- ONLY RUN THIS AFTER you've verified all migrations work and updated your code!

-- Step 1: Remove season text column from registrations (now using season_id)
-- ALTER TABLE registrations DROP COLUMN IF EXISTS season;

-- Step 2: Remove family_id from athletes (now using household_id)
-- First verify all athletes have household_id:
-- SELECT COUNT(*) FROM athletes WHERE family_id IS NOT NULL AND household_id IS NULL;
-- If count is 0, safe to drop:
-- ALTER TABLE athletes DROP COLUMN IF EXISTS family_id;

-- Step 3: Optionally drop families table (keep as backup for a while first!)
-- DROP TABLE IF EXISTS families;

-- Step 4: Optionally remove payment columns from registrations (keep as backup!)
-- ALTER TABLE registrations DROP COLUMN IF EXISTS amount_paid;
-- ALTER TABLE registrations DROP COLUMN IF EXISTS payment_status;

-- Note: I've commented these out for safety. Uncomment and run individually after verifying.

