# Debugging Registration RLS Policy Issues

## Step 1: Verify Migration 29 Was Run

Run this in Supabase SQL Editor to check if the RLS policies exist:

```sql
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'registrations'
ORDER BY policyname;
```

**Expected:** You should see policies like:
- "Parents can view registrations for their athletes"
- "Parents can insert registrations for their athletes"
- "Admins can view all registrations in their club"
- etc.

**If no policies exist:** Run migration `29_add_registrations_rls.sql` first.

## Step 2: Check Your User Setup

Run this diagnostic query (it uses your current auth context):

```sql
-- Check 1: Your profile
SELECT 
  'Your Profile' as check_type,
  id,
  email,
  role,
  club_id
FROM profiles
WHERE id = auth.uid();

-- Check 2: Your household link
SELECT 
  'Household Guardian Link' as check_type,
  hg.user_id,
  hg.household_id,
  h.name as household_name
FROM household_guardians hg
LEFT JOIN households h ON h.id = hg.household_id
WHERE hg.user_id = auth.uid();

-- Check 3: Your athletes and their club_id
SELECT 
  'Your Athletes' as check_type,
  a.id as athlete_id,
  a.first_name,
  a.last_name,
  a.household_id,
  a.club_id,
  hg.user_id as guardian_user_id
FROM athletes a
INNER JOIN household_guardians hg ON hg.household_id = a.household_id
WHERE hg.user_id = auth.uid();

-- Check 4: Verify you can see athletes (RLS check)
SELECT 
  'RLS Athletes Test' as check_type,
  id,
  first_name,
  last_name,
  household_id,
  club_id
FROM athletes
LIMIT 5;
```

## Step 3: Common Issues & Fixes

### Issue 1: No household_guardians link

**Symptom:** Check 2 returns no rows

**Fix:** Run migration `21_fix_missing_households.sql` or manually create the link:

```sql
-- Create household_guardians link
INSERT INTO household_guardians (household_id, user_id, is_primary)
SELECT 
  h.id,
  p.id,
  true
FROM profiles p
INNER JOIN households h ON h.primary_email = p.email AND h.club_id = p.club_id
WHERE p.id = auth.uid()
  AND p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
ON CONFLICT (household_id, user_id) DO NOTHING;
```

### Issue 2: Athlete club_id doesn't match

**Symptom:** Athletes have different `club_id` than your profile

**Fix:** Update athlete club_id:

```sql
-- Update athlete club_id to match your profile
UPDATE athletes a
SET club_id = (
  SELECT club_id 
  FROM profiles 
  WHERE id = auth.uid()
)
FROM household_guardians hg
WHERE hg.household_id = a.household_id
  AND hg.user_id = auth.uid()
  AND a.club_id IS DISTINCT FROM (SELECT club_id FROM profiles WHERE id = auth.uid());
```

### Issue 3: Athlete has no household_id

**Symptom:** Athletes have `household_id = null`

**Fix:** Link athletes to your household:

```sql
-- Link athletes to your household
UPDATE athletes a
SET household_id = (
  SELECT hg.household_id
  FROM household_guardians hg
  WHERE hg.user_id = auth.uid()
  LIMIT 1
)
WHERE a.household_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.club_id = a.club_id
  );
```

## Step 4: Test Registration Creation

After fixing the setup, try creating a registration manually to test:

```sql
-- Replace ATHLETE_ID and SUB_PROGRAM_ID with actual IDs
INSERT INTO registrations (
  athlete_id,
  sub_program_id,
  season_id,
  club_id,
  status,
  season
)
SELECT 
  'ATHLETE_ID_HERE'::uuid,
  'SUB_PROGRAM_ID_HERE'::uuid,
  (SELECT id FROM seasons WHERE is_current = true LIMIT 1),
  (SELECT club_id FROM profiles WHERE id = auth.uid()),
  'pending',
  (SELECT name FROM seasons WHERE is_current = true LIMIT 1)
RETURNING *;
```

If this works, the issue is in the application code. If it fails, the RLS policy still needs adjustment.

## Next Steps

If none of these fix the issue, run migration `31_fix_registrations_rls_policy.sql` which makes the policy more lenient.

