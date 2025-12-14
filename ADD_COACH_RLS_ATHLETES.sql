-- Add RLS policy for coaches to view athletes
-- Coaches should be able to view:
-- 1. All athletes in their club (simple approach)
-- 2. OR athletes assigned to programs/sub-programs/groups they coach (granular approach)

-- For now, let's use approach #1 (simpler): coaches can see all athletes in their club

-- Step 1: Check current policies
SELECT 
    'Current Athletes Policies' as check_type,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual ILIKE '%coach%' THEN '✅ Has coach access'
        ELSE '❌ No coach access'
    END as coach_access
FROM pg_policies
WHERE tablename = 'athletes';

-- Step 2: Create policy for coaches to view athletes in their club
-- First drop if exists, then create
DROP POLICY IF EXISTS "Coaches can view athletes in their club" ON athletes;

CREATE POLICY "Coaches can view athletes in their club"
ON athletes
FOR SELECT
TO authenticated
USING (
    club_id IN (
        SELECT club_id 
        FROM coaches 
        WHERE profile_id = auth.uid()
    )
);

-- Step 3: Verify the policy was created
SELECT 
    'New Athletes Policies' as check_type,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual ILIKE '%coach%' THEN '✅ Has coach access'
        ELSE '❌ No coach access'
    END as coach_access
FROM pg_policies
WHERE tablename = 'athletes'
ORDER BY policyname;

-- Step 4: Summary message
SELECT 
    '✅ Coach RLS Policy Added!' as status,
    'Coaches can now view all athletes in their club' as description,
    'Sign out, clear cache, and log back in as GTSSF Coach A to test' as next_step;
