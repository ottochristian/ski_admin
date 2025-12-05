# Database Migration Guide

## Overview

These migrations transform your single-club database into a multi-club, season-aware system aligned with your spec.

## Migration Order

**IMPORTANT:** Run migrations in this exact order:

1. `01_add_clubs.sql` - Adds clubs table and club_id to all tables
2. `02_add_seasons.sql` - Adds seasons table and season_id to relevant tables
3. `03_migrate_households.sql` - Migrates families → households + household_guardians
4. `04_add_orders_payments.sql` - Separates payments from registrations

## Before You Start

### 1. Backup Your Database
```sql
-- In Supabase, go to Settings → Database → Backups
-- Or export your schema:
pg_dump your_database_url > backup.sql
```

### 2. Check Your Registrations Table Structure
Before running migration 04, we need to see your registrations table:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'registrations'
ORDER BY ordinal_position;
```

Share the results so I can customize migration 04.

### 3. Test on Staging First
- Create a copy of your database
- Run migrations on the copy
- Verify everything works
- Then run on production

## Running Migrations

### Option 1: Supabase SQL Editor
1. Open Supabase Dashboard → SQL Editor
2. Copy/paste each migration file
3. Run one at a time
4. Check the verification query at the end

### Option 2: Command Line (if you have psql)
```bash
psql your_database_url < migrations/01_add_clubs.sql
psql your_database_url < migrations/02_add_seasons.sql
psql your_database_url < migrations/03_migrate_households.sql
psql your_database_url < migrations/04_add_orders_payments.sql
```

## After Each Migration

1. **Check the verification query** at the end of each migration
2. **Test your app** - Make sure existing features still work
3. **Update your code** - Add club_id/season_id filters to queries

## Post-Migration Tasks

### Code Updates Needed

After running migrations, update your code:

1. **Add club context** to all Supabase queries:
   ```typescript
   .eq('club_id', clubId)
   ```

2. **Add season filtering**:
   ```typescript
   .eq('season_id', seasonId)
   ```

3. **Update TypeScript types** - Add `club_id`, `season_id` to interfaces

4. **Update routing** - Add `/clubs/[clubSlug]` structure

5. **Update families → households** in code:
   - `families` → `households`
   - `family_id` → `household_id`
   - `families.profile_id` → `household_guardians`

6. **Update payment logic**:
   - Use `orders` and `payments` tables
   - Remove direct `registrations.amount_paid` usage

## Rollback Plan

If something goes wrong:

1. **Stop the migration** immediately
2. **Restore from backup**
3. **Review the issue** - Check error messages
4. **Fix the migration script** if needed
5. **Try again**

## Verification Checklist

After all migrations:

- [ ] All tables have `club_id` column
- [ ] Programs and registrations have `season_id`
- [ ] Households table has all family data
- [ ] Household_guardians links profiles to households
- [ ] Athletes have `household_id` (not just `family_id`)
- [ ] Orders table has migrated payment data
- [ ] App still loads without errors
- [ ] Admin can view programs/registrations
- [ ] No data loss (count rows before/after)

## Questions?

If you encounter issues:
1. Check the verification queries in each migration
2. Look for error messages in Supabase logs
3. Verify foreign key constraints aren't blocking
4. Check that default club/season were created

## Next Steps After Migrations

1. **Add club-aware routing** (`/clubs/[clubSlug]/...`)
2. **Add season selector** to admin UI
3. **Update parent portal** to use households
4. **Add Stripe integration** using orders/payments
5. **Add waivers system** (next migration)

