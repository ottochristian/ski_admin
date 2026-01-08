-- Migration 54: Add Waivers System
-- Root Cause: Waivers are required for legal compliance and are part of MVP core registration flow
-- This implements the waiver tables and signature tracking as specified in Plan.md

-- Step 1: Create waivers table
CREATE TABLE IF NOT EXISTS waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL, -- The actual waiver text content
  required BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id), -- Admin who created the waiver
  UNIQUE(club_id, season_id, title) -- Prevent duplicate waiver titles per club/season
);

-- Step 2: Create waiver_signatures table
CREATE TABLE IF NOT EXISTS waiver_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES waivers(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- Parent who signed
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  signed_name TEXT NOT NULL, -- What name they typed when signing
  ip_address INET, -- Optional: track signing IP for audit
  user_agent TEXT, -- Optional: track browser/device for audit
  UNIQUE(waiver_id, athlete_id, guardian_id) -- One signature per waiver/athlete/guardian combination
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waivers_club_season ON waivers(club_id, season_id);
CREATE INDEX IF NOT EXISTS idx_waivers_status ON waivers(status);
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_waiver ON waiver_signatures(waiver_id);
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_athlete ON waiver_signatures(athlete_id);
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_guardian ON waiver_signatures(guardian_id);
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_signed_at ON waiver_signatures(signed_at);

-- Step 4: Enable RLS on both tables
ALTER TABLE waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_signatures ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for waivers
-- Admins can manage waivers for their club
CREATE POLICY "Club admins can manage waivers" ON waivers
  FOR ALL USING (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );

-- Parents can view waivers for their club
CREATE POLICY "Parents can view waivers" ON waivers
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid()
    ) AND status = 'active'
  );

-- Step 6: Create RLS policies for waiver_signatures
-- Guardians can view signatures for their athletes
CREATE POLICY "Guardians can view waiver signatures for their athletes" ON waiver_signatures
  FOR SELECT USING (
    guardian_id = auth.uid() OR
    athlete_id IN (
      SELECT athlete_id FROM household_guardians hg
      JOIN households h ON hg.household_id = h.id
      WHERE hg.user_id = auth.uid()
    )
  );

-- Guardians can create signatures for their athletes
CREATE POLICY "Guardians can create waiver signatures" ON waiver_signatures
  FOR INSERT WITH CHECK (
    guardian_id = auth.uid() AND
    athlete_id IN (
      SELECT athlete_id FROM household_guardians hg
      JOIN households h ON hg.household_id = h.id
      WHERE hg.user_id = auth.uid()
    )
  );

-- Admins can view all signatures for their club
CREATE POLICY "Club admins can view all waiver signatures" ON waiver_signatures
  FOR SELECT USING (
    waiver_id IN (
      SELECT w.id FROM waivers w
      WHERE w.club_id IN (
        SELECT club_id FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
      )
    )
  );

-- Step 7: Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 8: Add updated_at trigger to waivers table
CREATE TRIGGER update_waivers_updated_at
  BEFORE UPDATE ON waivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Create a view for waiver status by athlete (helpful for admin dashboard)
CREATE OR REPLACE VIEW athlete_waiver_status AS
SELECT
  a.id as athlete_id,
  a.first_name,
  a.last_name,
  a.household_id,
  w.id as waiver_id,
  w.title as waiver_title,
  w.required,
  CASE
    WHEN ws.id IS NOT NULL THEN 'signed'
    ELSE 'unsigned'
  END as status,
  ws.signed_at,
  ws.signed_name
FROM athletes a
CROSS JOIN waivers w
LEFT JOIN waiver_signatures ws ON ws.waiver_id = w.id AND ws.athlete_id = a.id
WHERE w.status = 'active'
  AND w.club_id = a.club_id; -- Only waivers for the athlete's club

-- Step 10: Insert a sample waiver for testing (optional - remove in production)
-- This creates a basic waiver for the default club and current season
INSERT INTO waivers (club_id, season_id, title, body, required, created_by)
SELECT
  c.id,
  s.id,
  '2025-2026 Season Participation Waiver',
  E'SKI CLUB PARTICIPATION WAIVER\n\nI, the undersigned parent/guardian, hereby acknowledge and agree to the following:\n\n1. I understand that skiing and snowboarding involve inherent risks including but not limited to injury, death, or property damage.\n\n2. I voluntarily assume all risks associated with my child''s participation in ski club activities.\n\n3. I agree to indemnify and hold harmless the ski club, its coaches, volunteers, and sponsors from any claims arising from participation.\n\n4. I certify that my child is physically fit to participate and has my permission to receive medical treatment if needed.\n\n5. I agree to follow all club rules and coach instructions.\n\nBy typing my name below, I acknowledge that I have read and understood this waiver.',
  true,
  p.id
FROM clubs c
CROSS JOIN seasons s
LEFT JOIN profiles p ON p.role = 'system_admin' AND p.club_id = c.id
WHERE c.slug = 'default'
  AND s.is_current = true
  AND NOT EXISTS (
    SELECT 1 FROM waivers w
    WHERE w.club_id = c.id AND w.season_id = s.id
  )
LIMIT 1;

-- Step 11: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON waivers TO authenticated;
GRANT SELECT, INSERT ON waiver_signatures TO authenticated;
GRANT SELECT ON athlete_waiver_status TO authenticated;

-- Step 12: Create function to check if athlete has signed required waivers
CREATE OR REPLACE FUNCTION has_signed_required_waivers(p_athlete_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM waivers w
    LEFT JOIN waiver_signatures ws ON ws.waiver_id = w.id AND ws.athlete_id = p_athlete_id
    WHERE w.required = true
      AND w.status = 'active'
      AND ws.id IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Verification queries
SELECT
  'Waivers table created' as status,
  COUNT(*) as waiver_count
FROM waivers;

SELECT
  'Waiver signatures table created' as status,
  COUNT(*) as signature_count
FROM waiver_signatures;

SELECT
  'RLS enabled on waivers' as status,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'waivers';

SELECT
  'RLS enabled on waiver_signatures' as status,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'waiver_signatures';

SELECT
  'Sample waiver created' as status,
  title,
  required
FROM waivers
WHERE club_id = (SELECT id FROM clubs WHERE slug = 'default')
LIMIT 1;
