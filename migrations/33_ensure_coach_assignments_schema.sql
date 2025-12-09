-- Migration 33: Ensure coach_assignments table has proper schema
-- This ensures the table supports assignments to programs, sub_programs, and groups

-- Check if coach_assignments table exists, create if not
CREATE TABLE IF NOT EXISTS coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  sub_program_id UUID REFERENCES sub_programs(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'assistant_coach' CHECK (role IN ('head_coach', 'assistant_coach', 'substitute_coach')), -- Coach role for this assignment
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure at least one assignment level is specified
  CONSTRAINT coach_assignment_level_check CHECK (
    (program_id IS NOT NULL) OR 
    (sub_program_id IS NOT NULL) OR 
    (group_id IS NOT NULL)
  ),
  -- Prevent duplicate assignments (same coach, same program/sub-program/group, same season)
  -- Note: This allows the same coach to have different roles for the same assignment
  -- If you want to prevent that, add role to the unique constraint
  CONSTRAINT unique_coach_assignment UNIQUE (coach_id, program_id, sub_program_id, group_id, season_id)
);

-- Add club_id if it doesn't exist
ALTER TABLE coach_assignments ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE coach_assignments ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
-- Add role column with proper constraint if it doesn't exist
ALTER TABLE coach_assignments ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'assistant_coach';
-- Update constraint if role column exists but constraint doesn't
DO $$
BEGIN
  -- Drop existing constraint if it exists with old values
  ALTER TABLE coach_assignments DROP CONSTRAINT IF EXISTS coach_assignments_role_check;
  -- Add new constraint with correct values
  ALTER TABLE coach_assignments ADD CONSTRAINT coach_assignments_role_check 
    CHECK (role IN ('head_coach', 'assistant_coach', 'substitute_coach'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coach_assignments_coach_id ON coach_assignments(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_club_id ON coach_assignments(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_program_id ON coach_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_sub_program_id ON coach_assignments(sub_program_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_group_id ON coach_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_season_id ON coach_assignments(season_id);

-- Verify the structure
SELECT 
  'coach_assignments schema verified' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'coach_assignments'
ORDER BY ordinal_position;
