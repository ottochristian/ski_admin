# Potential Infinite Loop Issues - Analysis & Fixes

## 🔍 Found Patterns

### High Risk (Objects/Arrays from React Query as dependencies)

1. ✅ **app/admin/registrations/page.tsx** - FIXED
   - Issue: `useEffect` depended on `registrationsData` array
   - Fix: Use stable `registrationsKey` instead

2. ✅ **app/clubs/[clubSlug]/parent/programs/page.tsx** - FIXED
   - Issue: `useEffect` depended on `athletes` array
   - Fix: Use stable `athleteIds` string instead of array reference

3. ✅ **app/admin/coaches/[coachId]/assign/page.tsx** - FIXED
   - Issue: `useEffect` depended on `coach` object
   - Fix: Use `coach?.id` instead of `coach` object reference

4. ✅ **app/admin/programs/[programId]/edit/page.tsx** - FIXED
   - Issue: `useEffect` depended on `program` object
   - Fix: Use stable program properties (id, name, description, status) + functional setState guards

5. ✅ **app/admin/settings/branding/page.tsx** - FIXED
   - Issue: `useEffect` depended on `club` object
   - Fix: Use stable club properties (id, primary_color, logo_url) + functional setState guards

---

## 🔧 Fixes Needed

### Pattern to Fix
When `useEffect` depends on objects/arrays from React Query:
1. Use stable keys/IDs instead of object references
2. Add guards to prevent unnecessary state updates
3. Use functional setState when possible

---

## ✅ Safe Patterns (Already Good)

- **app/admin/page.tsx** - Uses `useMemo` for transformations ✅
- **app/admin/reports/page.tsx** - Uses `useMemo` for calculations ✅
- Most pages that just read data without setting state ✅


