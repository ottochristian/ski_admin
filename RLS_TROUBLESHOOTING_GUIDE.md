# RLS Not Working - Troubleshooting Guide

## Problem
GTSSF athletes still show up in Jackson admin portal even after fixing `club_id` values.

## Most Common Causes

### 1. ⚠️ Using SERVICE_ROLE Key Instead of ANON Key

**This is the #1 cause of RLS not working!**

If you're using the `service_role` key in your `.env.local`, RLS is **completely bypassed**.

Check your `.env.local`:
```bash
# WRONG - Bypasses RLS!
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cm9uZy1yZWYiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNTE2MjM5MDIyfQ...

# RIGHT - Respects RLS!
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cm9uZy1yZWYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTUxNjIzOTAyMn0...
```

**To fix:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the **`anon` public** key (NOT the `service_role` key!)
3. Update `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-here>
   ```
4. Restart your dev server: `npm run dev`

### 2. RLS Not Enabled on Athletes Table

Run this diagnostic script:
```sql
-- In Supabase SQL Editor
SELECT * FROM VERIFY_RLS_AND_ADMIN.sql
```

Look for:
- `rls_enabled` should be `true`
- Should see multiple policies listed
- Jackson admin's `club_id` should match Jackson club

If `rls_enabled` is `false` or no policies exist, run:
```sql
-- In Supabase SQL Editor
SELECT * FROM FORCE_ENABLE_RLS.sql
```

### 3. Cached Data in Browser

Even after fixing RLS, your browser might be showing cached data.

**To fix:**
1. Open browser DevTools (F12)
2. Go to Application tab → Storage
3. Click "Clear site data"
4. Or: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### 4. Jackson Admin Has Wrong club_id

Run the diagnostic:
```sql
SELECT 
  email,
  role,
  club_id,
  (SELECT name FROM clubs WHERE id = profiles.club_id) as club_name
FROM profiles
WHERE email LIKE '%jackson%admin%';
```

The `club_name` should be "Jackson". If it's not, update it:
```sql
UPDATE profiles
SET club_id = (SELECT id FROM clubs WHERE slug = 'jackson')
WHERE email LIKE '%jackson%admin%';
```

## Step-by-Step Debugging

### Step 1: Check Which Key You're Using
```bash
cat .env.local | grep NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Decode the JWT to see the role:
1. Copy your key
2. Go to https://jwt.io
3. Paste the key
4. Look at the `role` field in the payload
   - Should say `"role": "anon"` ✅
   - If it says `"role": "service_role"` ❌ you need the anon key!

### Step 2: Verify RLS Status
```sql
-- Run in Supabase SQL Editor
SELECT * FROM VERIFY_RLS_AND_ADMIN.sql
```

### Step 3: Force Enable RLS
```sql
-- Run in Supabase SQL Editor
SELECT * FROM FORCE_ENABLE_RLS.sql
```

### Step 4: Clear Browser Cache
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Or clear all site data in DevTools

### Step 5: Test
1. Log out
2. Log back in as Jackson admin
3. Navigate to Athletes page
4. Should only see Jackson athletes

## Verification Query

After all fixes, run this query **while logged in as Jackson admin** in your app:

```sql
-- This should ONLY return Jackson athletes
SELECT 
  a.first_name,
  a.last_name,
  c.name as club_name
FROM athletes a
JOIN clubs c ON c.id = a.club_id;
```

If you still see GTSSF athletes, the issue is definitely the service_role key!

## Quick Test for Service Role Key

Add this temporarily to your athletes page to check:

```typescript
// In app/clubs/[clubSlug]/admin/athletes/page.tsx
useEffect(() => {
  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Current user role:', session?.user?.role)
    console.log('User ID:', session?.user?.id)
  }
  checkAuth()
}, [])
```

If this logs `undefined` or shows no user, that's a problem!
