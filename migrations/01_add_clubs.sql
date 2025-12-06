-- Migration 01: Add Clubs Foundation
-- Run this in Supabase SQL Editor
-- This adds multi-club support to your existing schema

-- Step 1: Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  address TEXT,
  contact_email TEXT,
  timezone TEXT DEFAULT 'America/Denver',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create default club for existing data
INSERT INTO clubs (name, slug, primary_color) 
VALUES ('Default Club', 'default', '#3B82F6')
ON CONFLICT (slug) DO NOTHING;

-- Step 3: Add club_id to all existing tables (nullable first)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE families ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE sub_programs ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE coach_assignments ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE races ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE race_registrations ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);

-- Step 4: Backfill club_id with default club
DO $$
DECLARE
  default_club_id UUID := (SELECT id FROM clubs WHERE slug = 'default');
BEGIN
  UPDATE profiles SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE families SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE athletes SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE programs SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE sub_programs SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE groups SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE registrations SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE coaches SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE coach_assignments SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE races SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE race_registrations SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE race_results SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE messages SET club_id = default_club_id WHERE club_id IS NULL;
END $$;

-- Step 5: Make club_id NOT NULL (after backfilling)
ALTER TABLE profiles ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE families ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE athletes ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE programs ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE sub_programs ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE groups ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE registrations ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE coaches ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE coach_assignments ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE races ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE race_registrations ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE race_results ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN club_id SET NOT NULL;

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_club_id ON profiles(club_id);
CREATE INDEX IF NOT EXISTS idx_families_club_id ON families(club_id);
CREATE INDEX IF NOT EXISTS idx_athletes_club_id ON athletes(club_id);
CREATE INDEX IF NOT EXISTS idx_programs_club_id ON programs(club_id);
CREATE INDEX IF NOT EXISTS idx_sub_programs_club_id ON sub_programs(club_id);
CREATE INDEX IF NOT EXISTS idx_groups_club_id ON groups(club_id);
CREATE INDEX IF NOT EXISTS idx_registrations_club_id ON registrations(club_id);
CREATE INDEX IF NOT EXISTS idx_coaches_club_id ON coaches(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_club_id ON coach_assignments(club_id);
CREATE INDEX IF NOT EXISTS idx_races_club_id ON races(club_id);
CREATE INDEX IF NOT EXISTS idx_race_registrations_club_id ON race_registrations(club_id);
CREATE INDEX IF NOT EXISTS idx_race_results_club_id ON race_results(club_id);
CREATE INDEX IF NOT EXISTS idx_messages_club_id ON messages(club_id);

-- Verify migration
SELECT 
  'Clubs migration complete' as status,
  (SELECT COUNT(*) FROM clubs) as clubs_count,
  (SELECT COUNT(*) FROM profiles WHERE club_id IS NOT NULL) as profiles_with_club,
  (SELECT COUNT(*) FROM programs WHERE club_id IS NOT NULL) as programs_with_club;

