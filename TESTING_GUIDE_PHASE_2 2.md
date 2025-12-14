# Phase 2 Testing Guide - RLS-First Migration

## 🎯 Testing Objectives

1. **Verify RLS policies enforce club scoping** - Users can only see/modify their club's data
2. **Verify all pages load correctly** - No broken queries or missing data
3. **Verify React Query caching works** - Data loads efficiently and updates correctly
4. **Verify mutations work** - Create/update/delete operations function properly
5. **Verify cross-role access** - Admins, parents, coaches see appropriate data

## 🧪 Testing Checklist

### Prerequisites

1. **Set up test data** (if not already done):
   ```sql
   -- Create test users for each role in different clubs
   -- Ensure each club has:
   - At least 1 admin user
   - At least 1 parent user (with household and athletes)
   - At least 1 coach user
   - At least 1 season (marked as current)
   - At least 2-3 programs with sub-programs
   - At least 2-3 athletes
   - At least 1-2 coaches
   - Some registrations and orders
   ```

2. **Enable React Query DevTools** (optional but recommended):
   - Install: `npm install @tanstack/react-query-devtools`
   - Add to `app/layout.tsx` or providers
   - This helps visualize queries, cache states, and mutations

3. **Use browser DevTools**:
   - Network tab - Monitor API calls
   - Console - Check for errors
   - React DevTools - Inspect component state

---

## 📋 Role-Based Testing

### 1. Admin Portal Testing

#### Dashboard (`/admin`)
- [ ] Page loads without errors
- [ ] All stats display correctly (athletes count, registrations count, etc.)
- [ ] Numbers match actual database counts
- [ ] Recent registrations list shows correct data
- [ ] Season selector works and updates data
- [ ] Quick navigation links work

**How to test RLS:**
```sql
-- As admin user, check they only see their club's data
-- Count athletes in their club vs total athletes
SELECT COUNT(*) FROM athletes WHERE club_id = '<admin_club_id>';
```

#### Athletes Page (`/admin/athletes`)
- [ ] Athletes list loads
- [ ] Only shows athletes from admin's club
- [ ] Search/filter works (if implemented)
- [ ] Pagination works (if implemented)
- [ ] Can navigate to athlete details

**Test with 2 clubs:**
1. Login as Admin A (Club A)
2. Count athletes shown
3. Login as Admin B (Club B)
4. Verify different athletes shown

#### Coaches Page (`/admin/coaches`)
- [ ] Coaches list loads
- [ ] Only shows coaches from admin's club
- [ ] Assignments are displayed correctly
- [ ] Can assign coach to programs/sub-programs/groups
- [ ] Can navigate to coach details

**Test assignment:**
1. Assign coach to a program
2. Verify assignment appears
3. Assign same coach to sub-program
4. Verify both assignments show

#### Registrations Page (`/admin/registrations`)
- [ ] Registrations list loads
- [ ] Only shows registrations from admin's club
- [ ] Parent email is displayed correctly
- [ ] Status filters work
- [ ] Season filtering works

#### Programs Page (`/admin/programs`)
- [ ] Programs list loads
- [ ] Only shows programs from admin's club
- [ ] Sub-programs are shown correctly
- [ ] Can create new program
- [ ] Can edit program
- [ ] Can delete program (if allowed)
- [ ] Can create/edit/delete sub-programs

**Test create flow:**
1. Create new program
2. Verify it appears in list
3. Create sub-program under it
4. Verify it shows correctly

#### Reports Page (`/admin/reports`)
- [ ] Report data loads
- [ ] Revenue calculations are correct
- [ ] Program breakdown shows correct data
- [ ] Only shows data from admin's club

#### Seasons Settings (`/admin/settings/seasons`)
- [ ] Seasons list loads
- [ ] Can create new season
- [ ] Can set current season
- [ ] Can archive season
- [ ] Can clone season (verify programs/sub-programs/groups are cloned)

**Test clone:**
1. Create a season with programs/sub-programs
2. Clone the season
3. Verify all data is cloned correctly
4. Verify cloned items are set to INACTIVE

#### Coach Assign (`/admin/coaches/[coachId]/assign`)
- [ ] Page loads for specific coach
- [ ] Shows all programs/sub-programs/groups for coach's club
- [ ] Can select/deselect assignments
- [ ] Can set coach roles (head_coach, assistant_coach, etc.)
- [ ] Can save assignments
- [ ] Assignments persist correctly

---

### 2. Parent Portal Testing

#### Programs Page (`/clubs/[clubSlug]/parent/programs`)
- [ ] Page loads without errors
- [ ] Shows only active programs for current season
- [ ] Shows only programs from parent's club
- [ ] Can select athlete from dropdown
- [ ] Can add programs to cart
- [ ] Registration fees display correctly
- [ ] Max capacity displays correctly (if shown)

**Test RLS with 2 parents:**
1. Login as Parent A (Club A)
2. Note programs shown
3. Login as Parent B (Club B)
4. Verify different programs shown

#### Cart Page (`/clubs/[clubSlug]/parent/cart`)
- [ ] Cart displays items correctly
- [ ] Can remove items from cart
- [ ] Total calculation is correct
- [ ] Can proceed to checkout
- [ ] Prevents duplicate registrations
- [ ] Handles pending registrations correctly

**Test checkout flow:**
1. Add items to cart
2. Try to add duplicate (should prevent)
3. Proceed to checkout
4. Verify registrations are created
5. Verify order is created
6. Verify cart is cleared

#### Billing Page (`/clubs/[clubSlug]/parent/billing`)
- [ ] Orders list loads
- [ ] Only shows orders for parent's household
- [ ] Order details are correct
- [ ] Payment information displays correctly
- [ ] Success message shows after payment (if applicable)

**Test with multiple households:**
1. Create orders for Household A
2. Login as Parent B (different household)
3. Verify Parent B doesn't see Household A's orders

#### New Athlete (`/clubs/[clubSlug]/parent/athletes/new`)
- [ ] Form loads correctly
- [ ] Can create new athlete
- [ ] Athlete is associated with correct household
- [ ] Athlete appears in athletes list after creation

**Test athlete creation:**
1. Create athlete with all fields
2. Verify athlete saved correctly
3. Verify athlete linked to household
4. Verify athlete linked to club

---

### 3. Coach Portal Testing

#### View Athletes (`/coach/athletes`)
- [ ] Shows athletes from coach's assigned programs only
- [ ] Season filtering works
- [ ] Data updates when season changes

---

## 🔒 RLS Security Testing

### Critical Tests

1. **Cross-Club Data Access Prevention**
   ```sql
   -- Test: Admin from Club A should NOT see Club B's data
   -- Expected: All queries return empty or error
   
   -- As Admin A, try to query:
   SELECT * FROM athletes WHERE club_id = '<club_b_id>';
   -- Should return empty (RLS blocks it)
   ```

2. **Parent Access Control**
   ```sql
   -- Test: Parent should ONLY see their household's athletes
   -- As Parent user:
   SELECT * FROM athletes;
   -- Should only return athletes from their household
   ```

3. **Coach Assignment Scoping**
   ```sql
   -- Test: Coach should ONLY see their assigned programs/sub-programs
   -- As Coach user:
   SELECT * FROM programs;
   -- Should only return programs they're assigned to (if RLS policy exists)
   ```

### Manual Security Testing

1. **Try to access other club's data via URL manipulation**
   - Example: Try accessing `/admin/athletes/[other_club_athlete_id]`
   - Expected: Should show 404 or "not found" error

2. **Try to modify data from another club**
   - Example: Try to update a program from another club
   - Expected: Should fail or return error

3. **Test with browser DevTools**
   - Open Network tab
   - Watch API requests
   - Verify no data from other clubs is fetched
   - Verify all queries include proper filters (or rely on RLS)

---

## 🐛 Common Issues to Watch For

### 1. Missing Data / Empty Lists
**Symptom:** Pages show "No data" when data exists  
**Check:**
- RLS policies are active (`ENABLE ROW LEVEL SECURITY`)
- User's `club_id` matches data's `club_id`
- Season filtering is correct
- React Query cache is not stale

**Debug:**
```sql
-- Check user's club_id
SELECT id, club_id, role FROM profiles WHERE id = auth.uid();

-- Check data exists
SELECT COUNT(*) FROM athletes WHERE club_id = '<user_club_id>';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'athletes';
```

### 2. Infinite Loading States
**Symptom:** Page stays in loading state forever  
**Check:**
- React Query hook error handling
- Network requests completing
- RLS policies not causing query errors
- Console for JavaScript errors

**Debug:**
- Open React Query DevTools
- Check query status (pending, error, success)
- Check Network tab for failed requests
- Check browser console for errors

### 3. Data Not Updating After Mutation
**Symptom:** After creating/updating, data doesn't refresh  
**Check:**
- `queryClient.invalidateQueries` is called
- Query keys match
- React Query DevTools shows invalidation

**Fix:**
```tsx
// Ensure mutation invalidates correct queries
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['programs'] })
}
```

### 4. Wrong Club Data Showing
**Symptom:** User sees data from another club  
**Critical Security Issue!**

**Check:**
- RLS policies are enabled
- User's profile has correct `club_id`
- No manual filtering bypassing RLS
- No API routes bypassing RLS without verification

**Debug:**
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'athletes';

-- Test RLS as different user
SET ROLE '<other_club_user_id>';
SELECT * FROM athletes; -- Should be empty or filtered
```

### 5. Performance Issues
**Symptom:** Pages load slowly  
**Check:**
- RLS policies using indexes
- Multiple unnecessary queries
- React Query not caching properly
- N+1 query problems

**Optimize:**
- Check RLS policies use indexed columns (`club_id`)
- Verify queries use proper joins
- Use React Query's `select` option to transform data
- Batch related queries

---

## 🛠️ Testing Tools

### 1. React Query DevTools
```tsx
// Add to providers.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

**Use to:**
- See all active queries
- Check query cache
- Verify mutations
- See query status (pending, success, error)

### 2. Supabase Dashboard
- Go to SQL Editor
- Run test queries as different users
- Check RLS policies
- Monitor database performance

### 3. Browser DevTools
- **Network Tab:** Monitor all API requests
- **Console:** Check for errors/warnings
- **Application Tab:** Check localStorage, sessionStorage
- **React DevTools:** Inspect component state

### 4. SQL Test Script
Use the existing `TEST_RLS_AUTOMATIC_FILTERING.sql` script:
```bash
# Run test script
psql -h your-db-host -U your-user -d your-db -f TEST_RLS_AUTOMATIC_FILTERING.sql
```

---

## 📊 Testing Scenarios

### Scenario 1: Multi-Club Data Isolation
**Goal:** Verify clubs can't see each other's data

1. Create 2 clubs (Club A, Club B)
2. Create data for both clubs:
   - Athletes (2 in Club A, 2 in Club B)
   - Programs (2 in Club A, 2 in Club B)
   - Coaches (1 in Club A, 1 in Club B)
3. Login as Admin from Club A
4. Verify only Club A's data is visible
5. Login as Admin from Club B
6. Verify only Club B's data is visible

### Scenario 2: Season Filtering
**Goal:** Verify season-based filtering works

1. Create 2 seasons for a club
2. Create programs for Season 1
3. Set Season 2 as current
4. Login and verify only Season 2 programs show (or season selector works)
5. Switch seasons and verify data updates

### Scenario 3: Parent Registration Flow
**Goal:** Verify complete parent registration works

1. Login as parent
2. Browse programs
3. Add athlete to cart
4. Checkout
5. Verify registration created
6. Verify order created
7. Complete payment (if Stripe integrated)
8. Verify registration status updated

### Scenario 4: Coach Assignment
**Goal:** Verify coach can only see assigned programs

1. Create coach in Club A
2. Create 3 programs in Club A
3. Assign coach to 1 program
4. Login as coach
5. Verify coach only sees assigned program
6. Assign coach to another program
7. Verify both programs now visible

---

## ✅ Final Verification Steps

1. **Run the RLS Test Script**
   ```bash
   psql -f TEST_RLS_AUTOMATIC_FILTERING.sql
   ```
   All tests should pass.

2. **Check for Console Errors**
   - Open each page
   - Check browser console
   - No errors should appear

3. **Verify Database Queries**
   - Use Supabase Dashboard
   - Run queries as different users
   - Verify RLS is working

4. **Performance Check**
   - Load key pages
   - Check Network tab
   - Queries should be fast (<500ms)
   - No unnecessary duplicate queries

5. **User Acceptance Testing**
   - Have real users test
   - Gather feedback
   - Fix any issues found

---

## 🚨 Red Flags (Immediate Issues to Fix)

- ❌ **User can see another club's data** - Critical security issue
- ❌ **Page crashes on load** - JavaScript error
- ❌ **Data doesn't update after save** - Cache invalidation issue
- ❌ **Infinite loading** - Query error or RLS blocking
- ❌ **Wrong counts/calculations** - Data fetching or aggregation issue
- ❌ **Can't create/edit/delete** - Permission or RLS issue

---

## 📝 Test Results Template

```
Date: [Date]
Tester: [Name]
Branch: phase-2-simplify-data-layer-rls

Admin Portal:
- [ ] Dashboard - PASS/FAIL (notes)
- [ ] Athletes - PASS/FAIL (notes)
- [ ] Coaches - PASS/FAIL (notes)
- [ ] Programs - PASS/FAIL (notes)
- [ ] Registrations - PASS/FAIL (notes)
- [ ] Reports - PASS/FAIL (notes)
- [ ] Seasons Settings - PASS/FAIL (notes)

Parent Portal:
- [ ] Programs - PASS/FAIL (notes)
- [ ] Cart - PASS/FAIL (notes)
- [ ] Billing - PASS/FAIL (notes)
- [ ] New Athlete - PASS/FAIL (notes)

Coach Portal:
- [ ] Athletes View - PASS/FAIL (notes)

RLS Security:
- [ ] Cross-club access blocked - PASS/FAIL
- [ ] Parent data isolation - PASS/FAIL
- [ ] Coach assignment scoping - PASS/FAIL

Issues Found:
1. [Issue description]
2. [Issue description]

Overall Status: PASS/FAIL
```

---

## 🎯 Success Criteria

✅ All pages load without errors  
✅ All data is correctly scoped by club (RLS working)  
✅ All mutations (create/update/delete) work correctly  
✅ React Query caching works properly  
✅ No performance regressions  
✅ No security vulnerabilities  
✅ User experience is smooth and intuitive  

---

**Happy Testing! 🚀**

