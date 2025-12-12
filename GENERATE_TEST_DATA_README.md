# Test Data Generation Guide

This guide helps you generate comprehensive test data for your ski admin application.

## Overview

The script will:
1. ✅ Preserve your system admin account (`ottilieotto@gmail.com`)
2. ✅ Preserve GTSSF and Jackson clubs
3. 🗑️ Delete all other data
4. 👥 Create test users for both clubs
5. 🏠 Create households and link parents
6. 🎿 Create athletes (2 per parent)
7. 👨‍🏫 Create coaches
8. 📅 Create seasons (2024-2025)
9. 🏂 Create programs, sub-programs, and groups
10. 🔗 Assign coaches to programs

## User Format

All test users follow this format:
- **First Name**: Club name (`GTSSF` or `Jackson`)
- **Last Name**: Role + identifier (`Admin A`, `Parent B`, `Coach A`, etc.)
- **Email**: `ottilieotto+[club]+[role]+[identifier]@gmail.com`
- **Password**: `test12345`

### Users Created Per Club

**Admins:**
- Admin A, Admin B

**Coaches:**
- Coach A, Coach B

**Parents:**
- Parent A, Parent B, Parent C
- Each parent gets 2 athletes automatically

**Total**: 7 users per club × 2 clubs = 14 test users (plus your system admin)

## Step-by-Step Instructions

### Step 1: Backup (Important!)

Before running any scripts, **backup your database**:
1. Go to Supabase Dashboard > Settings > Database > Backups
2. Create a manual backup

### Step 2: Run Part 1 SQL Script

1. Open Supabase Dashboard > SQL Editor
2. Copy and paste contents of `GENERATE_TEST_DATA.sql`
3. Click "Run"
4. This will:
   - Delete all data except system admin and GTSSF/Jackson clubs
   - Create seasons
   - Create a temporary table with user definitions

### Step 3: Create Users with Passwords

You have two options:

#### Option A: Supabase Dashboard (Manual)
1. Go to Authentication > Users
2. For each email from the test_users_to_create table:
   - Click "Add User"
   - Email: `ottilieotto+[club]+[role]+[identifier]@gmail.com`
   - Password: `test12345`
   - Auto Confirm User: ✅ (checked)
   - Click "Create User"

**All 14 test users:**
- ottilieotto+gtssf+admin+a@gmail.com
- ottilieotto+gtssf+admin+b@gmail.com
- ottilieotto+gtssf+coach+a@gmail.com
- ottilieotto+gtssf+coach+b@gmail.com
- ottilieotto+gtssf+parent+a@gmail.com
- ottilieotto+gtssf+parent+b@gmail.com
- ottilieotto+gtssf+parent+c@gmail.com
- ottilieotto+jackson+admin+a@gmail.com
- ottilieotto+jackson+admin+b@gmail.com
- ottilieotto+jackson+coach+a@gmail.com
- ottilieotto+jackson+coach+b@gmail.com
- ottilieotto+jackson+parent+a@gmail.com
- ottilieotto+jackson+parent+b@gmail.com
- ottilieotto+jackson+parent+c@gmail.com

#### Option B: Supabase Management API (Automated)
See `SET_PASSWORDS_VIA_API.md` for instructions on using the API.

### Step 4: Verify Users Were Created

Run this query in SQL Editor:
```sql
SELECT 
  au.email,
  CASE WHEN p.id IS NULL THEN '❌ Missing Profile' ELSE '✅ Has Profile' END as status
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email LIKE 'ottilieotto+%'
ORDER BY au.email;
```

If profiles are missing, they should be created automatically by database triggers. If not, you may need to check your triggers.

### Step 5: Run Part 2 SQL Script

1. Open Supabase Dashboard > SQL Editor
2. Copy and paste contents of `GENERATE_TEST_DATA_PART2.sql`
3. Click "Run"
4. This will create:
   - Households for each parent
   - Athletes (2 per parent)
   - Coach records
   - Programs (3 per club: Alpine, Nordic, Freestyle)
   - Sub-programs (3 per program: Beginner, Intermediate, Advanced)
   - Groups (2 per sub-program)
   - Coach assignments

### Step 6: Verify Data

Run the verification query at the end of Part 2, or check manually:

```sql
-- Quick count check
SELECT 'Clubs' as type, COUNT(*) as count FROM clubs
UNION ALL
SELECT 'Seasons', COUNT(*) FROM seasons WHERE is_current = true
UNION ALL
SELECT 'Test Users', COUNT(*) FROM profiles WHERE email LIKE 'ottilieotto+%'
UNION ALL
SELECT 'Households', COUNT(*) FROM households
UNION ALL
SELECT 'Athletes', COUNT(*) FROM athletes
UNION ALL
SELECT 'Programs', COUNT(*) FROM programs
UNION ALL
SELECT 'Sub-Programs', COUNT(*) FROM sub_programs
UNION ALL
SELECT 'Groups', COUNT(*) FROM groups;
```

## Expected Results

### Per Club:
- **1 Season**: 2024-2025 Season
- **3 Programs**: Alpine Skiing, Nordic Skiing, Freestyle Skiing
- **9 Sub-Programs**: 3 per program (Beginner, Intermediate, Advanced)
- **18 Groups**: 2 per sub-program
- **3 Households**: One per parent
- **6 Athletes**: 2 per parent
- **2 Coaches**: Coach A and Coach B
- **2 Admins**: Admin A and Admin B
- **3 Parents**: Parent A, B, and C

## Troubleshooting

### Profiles Not Created Automatically

If profiles aren't created when you add users, check your database triggers:

```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%profile%';
```

You might need to manually create profiles:

```sql
INSERT INTO profiles (id, email, first_name, last_name, role, club_id)
SELECT 
  au.id,
  au.email,
  tu.first_name,
  tu.last_name,
  tu.role,
  tu.club_id
FROM auth.users au
JOIN test_users_to_create tu ON tu.email = au.email
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
);
```

### Club IDs Not Found

If you get errors about club IDs not being found, check:

```sql
SELECT id, name, slug FROM clubs;
```

Make sure you have clubs with slugs `gtssf` and `jackson` (case-insensitive).

### Season Creation Issues

If seasons aren't created, verify clubs exist first, then manually create:

```sql
INSERT INTO seasons (club_id, name, start_date, end_date, is_current, status)
SELECT 
  id,
  '2024-2025 Season',
  '2024-09-01',
  '2025-05-31',
  true,
  'active'
FROM clubs
WHERE slug IN ('gtssf', 'jackson')
ON CONFLICT DO NOTHING;
```

## Clean Up

If you need to start over:

```sql
-- WARNING: This deletes ALL data except system admin
-- Run GENERATE_TEST_DATA.sql Step 2 again
```

## Next Steps

After generating test data, you can:
1. Test admin portal with GTSSF Admin A or Jackson Admin A
2. Test parent portal with any parent account
3. Test coach portal with any coach account
4. Create registrations for athletes
5. Test the full registration flow

Enjoy testing! 🎿

