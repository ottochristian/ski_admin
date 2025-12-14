-- Migration 31: Fix registrations RLS policy to be more flexible
-- This addresses cases where household_guardians might not exist but families does

-- Drop and recreate the INSERT policy with better fallback logic
DROP POLICY IF EXISTS "Parents can insert registrations for their athletes" ON registrations;

CREATE POLICY "Parents can insert registrations for their athletes"
ON registrations
FOR INSERT
TO authenticated
WITH CHECK (
  -- Check via household_guardians (preferred)
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN household_guardians hg ON hg.household_id = a.household_id
    WHERE hg.user_id = auth.uid()
      AND a.id = registrations.athlete_id
      AND a.club_id = registrations.club_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN families f ON f.id = a.family_id
    WHERE f.profile_id = auth.uid()
      AND a.id = registrations.athlete_id
      AND (
        a.club_id = registrations.club_id
        OR a.club_id IS NULL
        OR registrations.club_id IS NULL
      )
  )
  OR
  -- Additional fallback: if athlete has no household_id/family_id but user has household
  -- and athlete's club_id matches
  (
    EXISTS (
      SELECT 1 
      FROM household_guardians hg
      WHERE hg.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 
      FROM athletes a
      WHERE a.id = registrations.athlete_id
        AND (
          a.household_id IS NULL 
          OR a.family_id IS NULL
        )
        AND a.club_id = registrations.club_id
    )
  )
);

-- Verify the policy was created
SELECT 
  'Registrations INSERT policy updated' as status,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'registrations'
  AND policyname = 'Parents can insert registrations for their athletes';


