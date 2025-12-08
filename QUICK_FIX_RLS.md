# Quick Fix for Registration RLS Error

## The Problem
Your query returned no rows, which means:
- ❌ No `household_guardians` link exists for your user
- OR your athletes aren't linked to a household
- OR the joins aren't matching

## Quick Fix (Run this in Supabase SQL Editor)

Run migration `32_fix_missing_household_links.sql` which will:
1. Create households for parents who don't have one
2. Link you to your household via `household_guardians`
3. Link athletes to households if missing
4. Fix athlete club_id mismatches

## After Running the Fix

Run this query again to verify:

```sql
SELECT 
  'Your Setup' as check,
  p.email,
  p.club_id as your_club_id,
  a.id as athlete_id,
  a.first_name || ' ' || a.last_name as athlete_name,
  a.club_id as athlete_club_id,
  a.household_id,
  hg.household_id as your_household_id,
  CASE 
    WHEN a.household_id = hg.household_id THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as household_match
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN athletes a ON a.household_id = hg.household_id
WHERE p.id = auth.uid();
```

You should now see rows with your athletes!

## Then Try Checkout Again

After the fix, try the checkout flow again. The RLS policy should now allow you to create registrations.
