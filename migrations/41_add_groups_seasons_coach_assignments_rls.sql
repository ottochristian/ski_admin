-- Migration 41: Add RLS policies for groups, seasons, and coach_assignments tables

-- ============================================
-- GROUPS TABLE
-- ============================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all groups in their club" ON groups;
DROP POLICY IF EXISTS "Admins can insert groups in their club" ON groups;
DROP POLICY IF EXISTS "Admins can update groups in their club" ON groups;
DROP POLICY IF EXISTS "Admins can delete groups in their club" ON groups;
DROP POLICY IF EXISTS "Coaches can view groups they're assigned to" ON groups;
DROP POLICY IF EXISTS "Parents can view groups in their club" ON groups;

-- Admins can view all groups in their club
-- OPTIMIZED: Use groups.club_id directly (more efficient than nested subqueries)
CREATE POLICY "Admins can view all groups in their club"
ON groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = groups.club_id
  )
);

-- Admins can insert groups in their club
-- OPTIMIZED: Use groups.club_id directly
CREATE POLICY "Admins can insert groups in their club"
ON groups
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = groups.club_id
  )
);

-- Admins can update groups in their club
-- OPTIMIZED: Use groups.club_id directly
CREATE POLICY "Admins can update groups in their club"
ON groups
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = groups.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = groups.club_id
  )
);

-- Admins can delete groups in their club
-- OPTIMIZED: Use groups.club_id directly
CREATE POLICY "Admins can delete groups in their club"
ON groups
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = groups.club_id
  )
);

-- Coaches can view groups they're assigned to
CREATE POLICY "Coaches can view groups they're assigned to"
ON groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.profile_id = p.id
    INNER JOIN coach_assignments ca ON ca.coach_id = c.id
    WHERE p.id = auth.uid()
      AND p.role = 'coach'
      AND ca.group_id = groups.id
  )
);

-- Parents can view groups in their club
-- OPTIMIZED: Use groups.club_id directly
CREATE POLICY "Parents can view groups in their club"
ON groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'parent'
      AND p.club_id = groups.club_id
  )
);

-- ============================================
-- SEASONS TABLE
-- ============================================

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all seasons in their club" ON seasons;
DROP POLICY IF EXISTS "Admins can insert seasons in their club" ON seasons;
DROP POLICY IF EXISTS "Admins can update seasons in their club" ON seasons;
DROP POLICY IF EXISTS "Admins can delete seasons in their club" ON seasons;
DROP POLICY IF EXISTS "Parents can view seasons in their club" ON seasons;
DROP POLICY IF EXISTS "Coaches can view seasons in their club" ON seasons;

-- Admins can manage seasons in their club
CREATE POLICY "Admins can view all seasons in their club"
ON seasons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = seasons.club_id
  )
);

CREATE POLICY "Admins can insert seasons in their club"
ON seasons
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = seasons.club_id
  )
);

CREATE POLICY "Admins can update seasons in their club"
ON seasons
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = seasons.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = seasons.club_id
  )
);

CREATE POLICY "Admins can delete seasons in their club"
ON seasons
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = seasons.club_id
  )
);

-- Parents can view seasons in their club
CREATE POLICY "Parents can view seasons in their club"
ON seasons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'parent'
      AND p.club_id = seasons.club_id
  )
);

-- Coaches can view seasons in their club
CREATE POLICY "Coaches can view seasons in their club"
ON seasons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'coach'
      AND p.club_id = seasons.club_id
  )
);

-- ============================================
-- COACH_ASSIGNMENTS TABLE
-- ============================================

ALTER TABLE coach_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can view their own assignments" ON coach_assignments;
DROP POLICY IF EXISTS "Admins can view all coach_assignments in their club" ON coach_assignments;
DROP POLICY IF EXISTS "Admins can insert coach_assignments in their club" ON coach_assignments;
DROP POLICY IF EXISTS "Admins can update coach_assignments in their club" ON coach_assignments;
DROP POLICY IF EXISTS "Admins can delete coach_assignments in their club" ON coach_assignments;

-- Coaches can view their own assignments
CREATE POLICY "Coaches can view their own assignments"
ON coach_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.profile_id = p.id
    WHERE p.id = auth.uid()
      AND p.role = 'coach'
      AND c.id = coach_assignments.coach_id
  )
);

-- Admins can manage coach_assignments in their club
-- OPTIMIZED: Use coach_assignments.club_id directly if available, otherwise check via coaches
CREATE POLICY "Admins can view all coach_assignments in their club"
ON coach_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.club_id = p.club_id
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND c.id = coach_assignments.coach_id
      AND (
        -- Use club_id directly if available, otherwise check via coaches
        (coach_assignments.club_id IS NOT NULL AND coach_assignments.club_id = p.club_id)
        OR (coach_assignments.club_id IS NULL AND p.club_id = c.club_id)
      )
  )
);

CREATE POLICY "Admins can insert coach_assignments in their club"
ON coach_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.club_id = p.club_id
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND c.id = coach_assignments.coach_id
      AND p.club_id = c.club_id
  )
);

CREATE POLICY "Admins can update coach_assignments in their club"
ON coach_assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.club_id = p.club_id
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND c.id = coach_assignments.coach_id
      AND p.club_id = c.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.club_id = p.club_id
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND c.id = coach_assignments.coach_id
      AND p.club_id = c.club_id
  )
);

CREATE POLICY "Admins can delete coach_assignments in their club"
ON coach_assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.club_id = p.club_id
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND c.id = coach_assignments.coach_id
      AND p.club_id = c.club_id
  )
);

-- Verify all policies were created
SELECT 
  'RLS policies created' as status,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('groups', 'seasons', 'coach_assignments')
GROUP BY tablename
ORDER BY tablename;
