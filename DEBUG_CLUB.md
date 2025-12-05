# Debugging Club Redirect Issue

## Expected Behavior

When you visit `/admin`, it should:
1. Get your profile's `club_id`
2. Look up the club by ID
3. Redirect to `/clubs/[slug]/admin`

The default club slug should be: **`default`**

So you should be redirected to: **`/clubs/default/admin`**

## Debugging Steps

### 1. Check if default club exists

Run this in Supabase SQL Editor:

```sql
SELECT id, name, slug FROM clubs WHERE slug = 'default';
```

Expected: Should return 1 row with slug = 'default'

### 2. Check if your profile has club_id

Run this (replace YOUR_USER_ID with your actual user ID):

```sql
SELECT id, email, club_id, role 
FROM profiles 
WHERE id = 'YOUR_USER_ID';
```

Expected: Should have a `club_id` that matches the default club's ID

### 3. Check browser console

Open browser DevTools → Console, and look for:
- `[AdminLayout] Redirecting to: /clubs/default/admin`
- Any errors related to club loading

### 4. Manual Test

Try visiting directly:
- `http://localhost:3000/clubs/default/admin`

If this works, the issue is just the redirect logic.

## Quick Fix

If the redirect isn't working, you can manually check:

1. **In Supabase**, verify:
   - Default club exists with slug 'default'
   - Your profile has `club_id` set

2. **If club_id is NULL**, run:
   ```sql
   UPDATE profiles 
   SET club_id = (SELECT id FROM clubs WHERE slug = 'default')
   WHERE club_id IS NULL;
   ```

3. **If default club doesn't exist**, run migration 01 again or create it:
   ```sql
   INSERT INTO clubs (name, slug, primary_color) 
   VALUES ('Default Club', 'default', '#3B82F6')
   ON CONFLICT (slug) DO NOTHING;
   ```

## Alternative: Force Default Club

If you want to always use 'default' without checking, you can temporarily hardcode:

```typescript
// In admin/layout.tsx, replace the redirect logic with:
router.replace('/clubs/default/admin')
```

But this is just for testing - the proper way is to get it from the profile.

