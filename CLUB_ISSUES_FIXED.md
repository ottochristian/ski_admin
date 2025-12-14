# Club Issues - Diagnosis & Fixes

## Issue 1: Club Logo Still Shows "J" After Uploading Picture ✅ FIXED

### Problem
- User uploaded a picture which updated the profile menu avatar (upper right corner)
- The club logo (icon next to page headlines) still showed "J"

### Root Cause
**You uploaded your personal profile picture, not the club logo!** There are two different images:
1. **Profile Picture** (`profiles.avatar_url`) - Your personal avatar shown in profile menu
2. **Club Logo** (`clubs.logo_url`) - Club's logo shown next to page titles

### Solution
✅ Created club-aware branding page: `/clubs/[clubSlug]/admin/settings/branding`
✅ Created settings index page: `/clubs/[clubSlug]/admin/settings`
✅ Updated admin sidebar to link to settings page

### How to Fix
1. Click **Settings** in the admin sidebar
2. Click **Club Branding**
3. Upload your club's logo (this is different from your profile picture!)
4. Save changes
5. Refresh the page - the logo will now appear instead of "J"

---

## Issue 2: GTSSF Athletes Showing in Jackson Admin Portal ⚠️ REQUIRES DATABASE FIX

### Problem
- Jackson admin portal showing GTSSF athletes instead of Jackson athletes
- This is a **critical data leakage issue**

### Root Cause
The athletes' `club_id` field is not set correctly. The RLS (Row Level Security) policy filters athletes by `club_id`, but if athletes don't have the correct `club_id`, they appear in the wrong admin portals.

### Solution
Run the diagnostic and fix scripts:

#### Step 1: Diagnose the Issue
Run this script to see what's wrong:
```bash
# In Supabase SQL Editor
SELECT * FROM DIAGNOSE_CLUB_ISSUES.sql
```

Look for:
- Jackson admin's `club_id` - should match Jackson club
- Athletes' `club_id` - should match their household's club

#### Step 2: Fix Athletes' club_id
Run this script to fix the data:
```bash
# In Supabase SQL Editor  
SELECT * FROM FIX_ATHLETES_CLUB_ID.sql
```

This will:
1. Update `athletes.club_id` to match their household's `club_id`
2. Handle legacy family-based athletes
3. Verify the fix worked

#### Step 3: Verify RLS Policies
If the fix script doesn't work, check if RLS policies are enabled:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'athletes';

-- Check if policies exist
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'athletes';
```

If RLS is not enabled or policies are missing, run:
```bash
# In Supabase SQL Editor
SELECT * FROM migrations/22_add_athletes_rls.sql
```

### Expected Result After Fix
- Jackson admin portal: Only Jackson athletes visible
- GTSSF admin portal: Only GTSSF athletes visible
- No cross-club data leakage

---

## Files Created/Modified

### New Files
- `app/clubs/[clubSlug]/admin/settings/page.tsx` - Settings index page
- `app/clubs/[clubSlug]/admin/settings/branding/page.tsx` - Club branding page
- `DIAGNOSE_CLUB_ISSUES.sql` - Diagnostic script
- `FIX_ATHLETES_CLUB_ID.sql` - Fix script for athletes

### Modified Files
- `components/admin-sidebar.tsx` - Updated Settings link to go to settings index

---

## Testing Checklist

### Club Logo
- [ ] Navigate to Settings > Club Branding
- [ ] Upload a club logo
- [ ] Verify logo appears next to page titles (replacing "J")
- [ ] Verify profile picture (upper right) is separate from club logo

### Athletes Filtering
- [ ] Run diagnostic script
- [ ] Run fix script
- [ ] Log in as Jackson admin
- [ ] Verify only Jackson athletes are visible
- [ ] Log in as GTSSF admin
- [ ] Verify only GTSSF athletes are visible

---

## Notes

**Profile Picture vs Club Logo:**
- **Profile Picture**: Your personal avatar (Settings > Edit Profile)
  - Shows in: Profile menu (upper right corner)
  - Field: `profiles.avatar_url`
  
- **Club Logo**: Your club's brand logo (Settings > Branding)
  - Shows in: Page headers next to titles
  - Field: `clubs.logo_url`

**Data Security:**
The athletes filtering issue is a reminder that **RLS policies are critical** for multi-tenant applications. Always verify:
1. RLS is enabled on all tables
2. Policies correctly filter by `club_id`
3. All records have correct `club_id` set

