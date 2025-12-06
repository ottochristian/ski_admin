# Fixing 400 Errors - Explanation

## What the Errors Mean

The **400 errors** you're seeing mean Supabase is rejecting the database queries. This usually happens when:

1. **Wrong table relationships** - Trying to query a relationship that doesn't exist
2. **Wrong column names** - Column doesn't exist or is misspelled
3. **Wrong query syntax** - Invalid Supabase query structure

## The Specific Issues

### Issue 1: `registrations` → `programs` relationship

**Problem:** The query was trying to do:
```typescript
registrations.select('programs(name)')
```

But `registrations` table doesn't have a direct link to `programs`. The relationship is:
- `registrations` → `sub_programs` (via `sub_program_id`)
- `sub_programs` → `programs` (via `program_id`)

**Fix:** Changed to:
```typescript
registrations.select('sub_programs(name, programs(name))')
```

### Issue 2: Status value case

**Problem:** Query was using `status=eq.active` but your database uses `'ACTIVE'` (uppercase) as the enum value.

**Fix:** Changed to `status=eq.ACTIVE`

## What I Fixed

1. ✅ Changed `programs(name)` → `sub_programs(name, programs(name))`
2. ✅ Changed `status=eq.active` → `status=eq.ACTIVE`
3. ✅ Updated data mapping to handle the nested structure

## Test It Now

Refresh your browser at `/admin` and the errors should be gone. The dashboard should load with:
- Athlete count
- Program count
- Registration count
- Recent registrations list

If you still see errors, check the browser console for the specific error message and we can fix it.

