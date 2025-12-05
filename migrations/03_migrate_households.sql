-- Migration 03: Migrate Families to Households
-- Run this AFTER migrations 01 and 02
-- This migrates your existing 'families' table to the 'households' + 'household_guardians' structure

-- Step 1: Create households table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  primary_email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create household_guardians join table
CREATE TABLE IF NOT EXISTS household_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Step 3: Migrate data from families to households
-- Preserve the family ID so we can update athletes.family_id → athletes.household_id
INSERT INTO households (
  id,  -- Keep same ID for easy migration
  club_id,
  primary_email,
  phone,
  address_line1,
  address_line2,
  city,
  state,
  zip_code,
  emergency_contact_name,
  emergency_contact_phone,
  created_at,
  updated_at
)
SELECT 
  f.id,
  COALESCE(f.club_id, (SELECT id FROM clubs WHERE slug = 'default')),
  p.email,
  p.phone,  -- From profiles if available
  f.address_line1,
  f.address_line2,
  f.city,
  f.state,
  f.zip_code,
  f.emergency_contact_name,
  f.emergency_contact_phone,
  f.created_at,
  f.updated_at
FROM families f
LEFT JOIN profiles p ON f.profile_id = p.id
ON CONFLICT (id) DO NOTHING;

-- Step 4: Link guardians (from families.profile_id)
INSERT INTO household_guardians (household_id, user_id, is_primary)
SELECT 
  f.id,
  f.profile_id,
  true  -- The profile_id in families is the primary guardian
FROM families f
WHERE f.profile_id IS NOT NULL
ON CONFLICT (household_id, user_id) DO NOTHING;

-- Step 5: Update athletes to use household_id instead of family_id
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);

-- Migrate the relationship
UPDATE athletes a
SET household_id = a.family_id  -- Since we kept the same ID
WHERE a.family_id IS NOT NULL 
  AND a.household_id IS NULL
  AND EXISTS (SELECT 1 FROM households h WHERE h.id = a.family_id);

-- Step 6: Make household_id NOT NULL (after verifying all athletes have one)
-- First check if any athletes are missing household_id
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM athletes
  WHERE family_id IS NOT NULL AND household_id IS NULL;
  
  IF missing_count > 0 THEN
    RAISE NOTICE 'Warning: % athletes have family_id but no matching household_id', missing_count;
  END IF;
END $$;

-- For now, keep family_id column (we'll drop it later after verifying everything works)
-- You can drop it manually after confirming the migration worked:
-- ALTER TABLE athletes DROP COLUMN family_id;

-- Step 7: Add indexes
CREATE INDEX IF NOT EXISTS idx_households_club_id ON households(club_id);
CREATE INDEX IF NOT EXISTS idx_household_guardians_household_id ON household_guardians(household_id);
CREATE INDEX IF NOT EXISTS idx_household_guardians_user_id ON household_guardians(user_id);
CREATE INDEX IF NOT EXISTS idx_athletes_household_id ON athletes(household_id);

-- Verify migration
SELECT 
  'Households migration complete' as status,
  (SELECT COUNT(*) FROM households) as households_count,
  (SELECT COUNT(*) FROM household_guardians) as guardians_count,
  (SELECT COUNT(*) FROM athletes WHERE household_id IS NOT NULL) as athletes_with_household,
  (SELECT COUNT(*) FROM athletes WHERE family_id IS NOT NULL AND household_id IS NULL) as athletes_missing_household;

-- Note: After verifying everything works, you can:
-- 1. Drop the families table (or keep as backup)
-- 2. Drop athletes.family_id column
-- 3. Update all code references from families → households

