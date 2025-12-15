# Season Migration Execution Order

## Problem

You're seeing: `new row for relation "seasons" violates check constraint "seasons_status_check"`

This means the database constraint doesn't allow `'closed'` as a valid status yet.

## Root Cause

The full migration (`migrations/42_improve_season_constraints.sql`) hasn't been run yet, which:
1. Fixes duplicate current seasons
2. Adds the updated constraint with `'closed'` included

## Solution: Execute in This Order

### Step 1: Fix the Constraint (Quick Fix)

**Run:** `FIX_SEASONS_STATUS_CONSTRAINT.sql`

This will:
- Drop the old constraint (only has draft/active/archived)
- Add new constraint (includes draft/active/closed/archived)
- Allow the UI "Close" button to work immediately

**This is safe to run immediately** - no data changes, just constraint update.

### Step 2: Fix Duplicate Current Seasons (Optional but Recommended)

**Run:** `FIX_DUPLICATE_CURRENT_SEASONS.sql`

This will:
- Show which clubs have multiple `is_current = true` seasons
- Keep the most recent one as current
- Set others to `is_current = false`

### Step 3: Run Full Migration (Complete Setup)

**Run:** `migrations/42_improve_season_constraints.sql`

This is now safe to run and will:
- Update constraint (already done in Step 1, but idempotent)
- Fix any remaining duplicate current seasons (already done in Step 2)
- Add unique index to prevent future duplicates ← **This is the key part**
- Add database comments for documentation

## Quick Start (Minimum)

If you just want to make the "Close" button work right now:

```sql
-- Run ONLY this:
FIX_SEASONS_STATUS_CONSTRAINT.sql
```

Then try clicking "Close" again - it should work!

## Complete Setup (Recommended)

For full production-ready season management:

```sql
-- Run these in order:
1. FIX_SEASONS_STATUS_CONSTRAINT.sql      -- Fixes immediate UI issue
2. FIX_DUPLICATE_CURRENT_SEASONS.sql      -- Cleans up data
3. migrations/42_improve_season_constraints.sql  -- Enforces constraints
```

## What Each Status Means

After fixing:
- `draft`: Setting up, not visible to parents
- `active`: Open for registrations ✅
- `closed`: No new registrations, but viewable ✅ NEW!
- `archived`: Historical, read-only

## Testing After Fix

1. Go to **Settings → Seasons**
2. Find an active season
3. Click **"Close"** button
4. It should change to `closed` status without error ✅
5. The **"Reopen"** button should appear
6. Click **"Reopen"** to change back to `active` ✅
