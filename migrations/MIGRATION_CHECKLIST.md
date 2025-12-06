# Migration Checklist

Use this checklist to track your migration progress.

## Pre-Migration

- [ ] **Backup database** (Supabase Dashboard → Settings → Database → Backups)
- [ ] **Test on staging/copy** if possible
- [ ] **Review all migration files** to understand what they do
- [ ] **Get registrations table structure** ✅ (Done - you provided it)

## Migration 01: Clubs

- [ ] Run `01_add_clubs.sql` in Supabase SQL Editor
- [ ] Check verification query shows:
  - [ ] 1 club created
  - [ ] All profiles have club_id
  - [ ] All programs have club_id
- [ ] **Test app** - Admin pages should still load
- [ ] **No errors** in browser console

## Migration 02: Seasons

- [ ] Run `02_add_seasons.sql`
- [ ] Check verification query shows:
  - [ ] At least 1 season created
  - [ ] All programs have season_id
  - [ ] All registrations have season_id
- [ ] **Test app** - Programs should still display
- [ ] **Check season matching** - Verify registrations.season text matched to seasons.name

## Migration 03: Households

- [ ] Run `03_migrate_households.sql`
- [ ] Check verification query shows:
  - [ ] Same number of households as families
  - [ ] All guardians linked in household_guardians
  - [ ] All athletes have household_id
- [ ] **Test app** - Dashboard should still work
- [ ] **Verify data** - Check a few households manually in Supabase

## Migration 04: Orders & Payments

- [ ] Run `04_add_orders_payments.sql`
- [ ] Check verification query shows:
  - [ ] Orders created (should match paid registrations)
  - [ ] Order items created
  - [ ] Payments created for paid orders
- [ ] **Test app** - Registrations page should still work
- [ ] **Verify totals** - Sum of orders should match sum of registrations.amount_paid

## Post-Migration Code Updates

### Update Supabase Queries

- [ ] Add `.eq('club_id', clubId)` to all queries
- [ ] Add `.eq('season_id', seasonId)` where needed
- [ ] Update `families` → `households` in code
- [ ] Update `family_id` → `household_id` in code
- [ ] Update payment logic to use `orders`/`payments` tables

### Update TypeScript Types

- [ ] Add `club_id` to relevant interfaces
- [ ] Add `season_id` to relevant interfaces
- [ ] Update `Family` → `Household` types
- [ ] Add `Order`, `OrderItem`, `Payment` types

### Update Routes

- [ ] Add `/clubs/[clubSlug]` route structure
- [ ] Update middleware to extract club from URL
- [ ] Add season selector to admin UI

## Migration 05: Cleanup (Optional - Later)

- [ ] **Wait at least 1 week** after all migrations
- [ ] **Verify everything works** with new structure
- [ ] **Update all code** to not use old columns
- [ ] Run `05_cleanup_old_columns.sql` (uncomment sections as needed)

## Final Verification

- [ ] All admin pages load
- [ ] Programs display correctly
- [ ] Registrations display correctly
- [ ] Athletes linked to households
- [ ] Orders show payment history
- [ ] No data loss (compare row counts before/after)
- [ ] No broken foreign keys
- [ ] App works in production

## Rollback Plan

If something breaks:

1. **Stop immediately**
2. **Restore from backup**
3. **Review error messages**
4. **Fix migration script**
5. **Try again on copy first**

## Questions to Answer

- [ ] What's your default club name? (Currently "Default Club")
- [ ] What's your current season name format? (e.g., "2024-2025")
- [ ] Do you want to keep `families` table as backup?
- [ ] Do you want to keep `registrations.amount_paid` as backup?

