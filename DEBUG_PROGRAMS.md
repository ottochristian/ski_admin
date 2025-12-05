# Debugging Programs Not Showing

## Quick Check - Run This in Supabase SQL Editor

```sql
-- Check if programs have club_id set
SELECT id, name, status, club_id 
FROM programs 
WHERE status = 'ACTIVE'
LIMIT 10;

-- Check what club_id your profile has
SELECT id, email, club_id 
FROM profiles 
WHERE email = 'your-email@example.com';

-- Check if club_id matches
SELECT p.id, p.name, p.club_id, pr.club_id as profile_club_id
FROM programs p
CROSS JOIN profiles pr
WHERE p.status = 'ACTIVE'
  AND pr.email = 'your-email@example.com'
LIMIT 10;
```

## Common Issues

1. **Programs don't have club_id** - Migration might not have backfilled correctly
2. **Programs have different club_id than your profile** - Filter is working but excluding them
3. **Status mismatch** - Programs might be 'active' (lowercase) not 'ACTIVE' (uppercase)

## Quick Fix

If programs don't have club_id, run:

```sql
-- Get your club_id
SELECT id FROM clubs WHERE slug = 'default';

-- Update programs (replace CLUB_ID with the ID from above)
UPDATE programs 
SET club_id = 'CLUB_ID'
WHERE club_id IS NULL;
```

