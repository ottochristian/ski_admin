# Quick Fix for RLS Issue

Your Supabase key is correct (using `anon` role), so the issue is likely:
1. RLS policies need to be recreated
2. Browser cache showing old data

## Step 1: Force Enable RLS and Recreate Policies

Run this in Supabase SQL Editor:

```sql
-- Copy and paste the contents of FORCE_ENABLE_RLS.sql
```

Or run the file: `FORCE_ENABLE_RLS.sql`

## Step 2: Clear Browser Cache

**Option A: Hard Refresh**
- Mac: `Cmd + Shift + R`
- Windows: `Ctrl + Shift + R`

**Option B: Clear All Data**
1. Open DevTools (F12)
2. Application tab → Storage → Clear site data
3. Refresh page

## Step 3: Log Out and Log Back In

1. Click profile menu → Sign Out
2. Log back in as Jackson admin
3. Go to Athletes page
4. Should only see Jackson athletes now

## Step 4: Verify It Worked

Run this diagnostic to confirm:

```sql
-- Run VERIFY_RLS_AND_ADMIN.sql in Supabase SQL Editor
```

Look for:
- `rls_enabled` = `true` ✅
- Multiple policies listed ✅
- Only Jackson athletes in "Expected Athletes" section ✅

---

## If It Still Doesn't Work

Add this temporarily to the athletes page to debug:

```typescript
// In app/clubs/[clubSlug]/admin/athletes/page.tsx
// Add at the top of the component

useEffect(() => {
  async function debug() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, club_id')
      .eq('id', user?.id)
      .single()
    
    console.log('=== DEBUG INFO ===')
    console.log('User ID:', user?.id)
    console.log('Profile:', profile)
    console.log('Athletes query will filter by club_id:', profile?.club_id)
  }
  debug()
}, [])
```

This will show you in the browser console what club_id is being used for filtering.

