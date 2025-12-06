# Database Schema Audit & Gap Analysis

## Current Tables (14 total)

1. ✅ `profiles` - User profiles with roles
2. ✅ `families` - Family/household data (needs migration to `households`)
3. ✅ `athletes` - Athlete information
4. ✅ `programs` - Top-level programs
5. ✅ `sub_programs` - Sub-programs within programs
6. ✅ `groups` - Groups within sub-programs
7. ✅ `registrations` - Athlete registrations
8. ✅ `coach_assignments` - Coach to program assignments
9. ✅ `races` - Race events (AHEAD of spec!)
10. ✅ `race_registrations` - Race entries (AHEAD of spec!)
11. ✅ `messages` - Communication messages (AHEAD of spec!)
12. ✅ `message_recipients` - Message delivery tracking (AHEAD of spec!)
13. ✅ `coaches` - Coach profiles
14. ✅ `race_results` - Race results (AHEAD of spec!)

---

## Missing Critical Tables (Per Spec)

### Foundation Layer (HIGHEST PRIORITY)
1. ❌ `clubs` - Multi-club support
2. ❌ `seasons` - Season-scoped data
3. ❌ `sports` - Sports layer (Alpine, Nordic, etc.) - currently programs seem to be top-level

### Household/Guardian Layer (HIGH PRIORITY)
4. ❌ `households` - Need to migrate from `families`
5. ❌ `household_guardians` - Join table for multiple guardians per household

### Payment Layer (HIGH PRIORITY)
6. ❌ `orders` - Order/invoice management
7. ❌ `order_items` - Line items in orders
8. ❌ `payments` - Payment records (might be in registrations currently)

### Waiver Layer (MEDIUM PRIORITY)
9. ❌ `waivers` - Waiver templates
10. ❌ `waiver_signatures` - Signed waivers per athlete

### Advanced Features (LOWER PRIORITY - Can add later)
11. ❌ `discount_codes` - Discount/promo codes
12. ❌ `events` / `calendar_items` - Calendar events (you have races, but not general events)

---

## Schema Analysis Needed

To create a proper migration plan, we need to see:

### For each existing table, we need:
- Column names and types
- Foreign key relationships
- Indexes
- Constraints

### Key Questions:
1. **Does `families` table have the structure we need, or does it need migration?**
   - Does it have: `primary_guardian_id`, `address`, `phone`, `emergency_contact`?
   - Or is it simpler?

2. **How are payments currently stored?**
   - In `registrations` table? (e.g., `amount_paid`, `payment_status`?)
   - Or separate?

3. **What's the relationship between `programs` and sports?**
   - Are programs already sport-specific?
   - Or do we need to add a `sports` layer?

4. **Do any tables have `club_id` or `season_id` already?**
   - Or is everything global/single-club?

---

## Recommended Next Steps

### Step 1: Get Full Schema Details
Run this in Supabase SQL Editor to get all table structures:

```sql
-- Get all table structures
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

### Step 2: Get Foreign Key Relationships
```sql
-- Get all foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

### Step 3: Create Migration Plan
Once we have the schema, I'll create:
1. SQL migration scripts
2. Data migration scripts (for existing data)
3. Code update checklist

---

## Priority Migration Order

### Phase 1: Foundation (Week 1)
1. **Clubs** - Add `clubs` table, add `club_id` to existing tables
2. **Seasons** - Add `seasons` table, add `season_id` to programs/registrations
3. **Sports** - Add `sports` table, restructure program hierarchy

### Phase 2: Household & Payment (Week 2)
4. **Households** - Migrate `families` → `households`, add `household_guardians`
5. **Orders & Payments** - Extract payment logic from registrations

### Phase 3: Waivers & Polish (Week 3)
6. **Waivers** - Add waiver system
7. **Discount Codes** - If needed for v1

---

## Action Items

**Immediate:**
- [ ] Run schema export queries above
- [ ] Share results so I can create detailed migration plan
- [ ] Decide: Multi-club now or single-club for MVP?

**This Week:**
- [ ] Create Clubs table + migration
- [ ] Add club_id to existing tables
- [ ] Update code to be club-aware

**Next Week:**
- [ ] Add Seasons
- [ ] Migrate Households
- [ ] Separate Orders/Payments

