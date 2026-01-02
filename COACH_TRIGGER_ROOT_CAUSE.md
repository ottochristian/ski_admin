# Coach Trigger Root Cause Analysis

## Problem
Newly invited coaches were not appearing in the coaches list after invitation.

## Investigation Results

### What We Found
1. **Profile was created** ✓ (in `profiles` table with `role='coach'`)
2. **Auth user was created** ✓ (in `auth.users`)
3. **Coach record was NOT created** ✗ (missing from `coaches` table)

### Root Cause
**The database triggers were missing entirely!**

When we checked `information_schema.triggers` for the `profiles` table:
```sql
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'profiles' 
  AND trigger_name LIKE '%coach%';
```

**Result: NO ROWS** (0 triggers found)

Even though:
- Migration 35 (lines 66-85) **should have created** two triggers
- Migration 52 **fixed the function** but didn't verify/recreate the triggers
- The `ensure_coach_record()` function **existed** but was never being called

## Hypothesis: Why Were Triggers Missing?

Possible reasons:
1. Migration 35 may have failed silently during trigger creation
2. Triggers may have been accidentally dropped
3. Triggers may not have been applied to production database
4. PostgreSQL may have had an error creating triggers that wasn't caught

## The Fix: Migration 53

Created `/migrations/53_create_missing_coach_triggers.sql` which:

1. **Drops** any existing coach triggers (clean slate)
2. **Creates** both required triggers:
   ```sql
   CREATE TRIGGER trigger_ensure_coach_record_on_insert
   AFTER INSERT ON profiles
   FOR EACH ROW
   WHEN (NEW.role = 'coach')
   EXECUTE FUNCTION ensure_coach_record();
   
   CREATE TRIGGER trigger_ensure_coach_record_on_update
   AFTER UPDATE ON profiles
   FOR EACH ROW
   WHEN (NEW.role = 'coach' AND ...)
   EXECUTE FUNCTION ensure_coach_record();
   ```
3. **Verifies** triggers were created successfully
4. **Backfills** any orphaned coach profiles (creates missing coach records)
5. **Confirms** no orphans remain

## Results After Migration 53

✅ Both triggers now exist and are active
✅ All orphaned profiles were backfilled (2 coach records created)
✅ Future coach invitations will automatically create coach records

## Files Changed
- `migrations/53_create_missing_coach_triggers.sql` (new)
- No application code changes needed

## Testing
1. Invite a new coach
2. Verify they appear in coaches list immediately
3. Check database: profile AND coach record should both exist

## Lessons Learned
1. Always verify triggers exist after running migrations
2. Migration verification steps (SELECT queries) should be mandatory
3. Silent failures in trigger creation can cause data consistency issues
4. Add monitoring/alerts for orphaned records
