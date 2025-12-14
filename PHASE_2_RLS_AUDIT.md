# Phase 2: RLS Policies Audit

## Tables with RLS Enabled

### ✅ Has RLS Policies

1. **profiles** (migration 08)
   - Users can view/update their own profile
   - Admins can view/update all profiles

2. **athletes** (migration 22)
   - Parents can view/insert/update athletes in their household
   - Admins can view/insert/update athletes in their club
   - **✅ Filters by club_id:** `p.club_id = athletes.club_id`

3. **registrations** (migration 29)
   - Parents can view/insert/update registrations for their athletes
   - Admins can view/insert/update/delete registrations in their club
   - **✅ Filters by club_id:** `p.club_id = registrations.club_id`

4. **coaches** (migration 34)
   - Coaches can view/update their own record
   - Admins can view/insert/update/delete coaches in their club
   - **✅ Filters by club_id:** `p.club_id = coaches.club_id`

5. **households** (migration 38)
   - Parents can view/update their household
   - Admins can view all households in their club
   - **✅ Filters by club_id:** `p.club_id = households.club_id`

6. **household_guardians** (migration 38)
   - Parents can view their guardian link
   - Admins can view all household_guardians in their club
   - **✅ Filters by club_id:** Uses helper function

### ❌ Missing RLS Policies

1. **programs** - No RLS policies found
   - ⚠️ CRITICAL: This table needs RLS!
   - Currently relies entirely on manual filtering

2. **sub_programs** - No RLS policies found
   - ⚠️ CRITICAL: This table needs RLS!

3. **groups** - No RLS policies found
   - ⚠️ CRITICAL: This table needs RLS!

4. **seasons** - No RLS policies found
   - Should be scoped by club

5. **clubs** - Likely doesn't need RLS (system-wide)

6. **coach_assignments** - No RLS policies found
   - Should be scoped by club

## Recommendation

**Before removing manual filtering**, we need to:

1. ✅ Create RLS policies for `programs` table
2. ✅ Create RLS policies for `sub_programs` table  
3. ✅ Create RLS policies for `groups` table
4. ✅ Create RLS policies for `seasons` table
5. ✅ Create RLS policies for `coach_assignments` table

## Action Items

1. Create migration for missing RLS policies
2. Test that RLS properly filters data
3. Then remove manual filtering from client code


