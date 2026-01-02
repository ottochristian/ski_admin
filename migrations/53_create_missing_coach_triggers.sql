-- Migration 53: Create missing coach triggers
-- Root Cause: Migration 35 created triggers, but they don't exist in the database
-- Migration 52 fixed the function but didn't recreate the triggers
-- This migration ensures the triggers are created

-- Step 1: Drop existing triggers if they somehow exist
DROP TRIGGER IF EXISTS trigger_ensure_coach_record_on_insert ON profiles;
DROP TRIGGER IF EXISTS trigger_ensure_coach_record_on_update ON profiles;

-- Step 2: Create trigger for INSERT - auto-create coach record when profile with coach role is inserted
CREATE TRIGGER trigger_ensure_coach_record_on_insert
AFTER INSERT ON profiles
FOR EACH ROW
WHEN (NEW.role = 'coach')
EXECUTE FUNCTION ensure_coach_record();

-- Step 3: Create trigger for UPDATE - update coach record when profile with coach role is updated
CREATE TRIGGER trigger_ensure_coach_record_on_update
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (NEW.role = 'coach' AND (
  OLD.role != 'coach' OR
  OLD.club_id IS DISTINCT FROM NEW.club_id OR
  OLD.first_name IS DISTINCT FROM NEW.first_name OR
  OLD.last_name IS DISTINCT FROM NEW.last_name OR
  OLD.email IS DISTINCT FROM NEW.email
))
EXECUTE FUNCTION ensure_coach_record();

-- Step 4: Verify triggers were created successfully
SELECT 
  'Coach Triggers Created' as status,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name LIKE '%coach%'
ORDER BY trigger_name;

-- Step 5: Verify the function exists and is callable
SELECT 
  'Function Status' as status,
  proname as function_name,
  prokind as function_type,
  provolatile as volatility
FROM pg_proc
WHERE proname = 'ensure_coach_record';

-- Step 6: Test the trigger by checking if any coach profiles are missing coach records
SELECT 
  'Orphaned Coach Profiles (should be 0)' as status,
  COUNT(*) as orphaned_count
FROM profiles p
LEFT JOIN coaches c ON c.profile_id = p.id
WHERE p.role = 'coach'
  AND c.id IS NULL;

-- Step 7: If there are orphaned profiles, create their coach records
-- (This handles any profiles created before the trigger was fixed)
INSERT INTO coaches (profile_id, club_id, first_name, last_name, email)
SELECT 
  p.id,
  p.club_id,
  p.first_name,
  p.last_name,
  p.email
FROM profiles p
LEFT JOIN coaches c ON c.profile_id = p.id
WHERE p.role = 'coach'
  AND c.id IS NULL
ON CONFLICT (profile_id) DO NOTHING;

-- Step 8: Final verification - no orphaned profiles should remain
SELECT 
  'Final Verification (should be 0)' as status,
  COUNT(*) as orphaned_count
FROM profiles p
LEFT JOIN coaches c ON c.profile_id = p.id
WHERE p.role = 'coach'
  AND c.id IS NULL;
