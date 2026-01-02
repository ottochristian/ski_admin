# Complete Cache Invalidation Audit & Fix

## Audit Results (20 files checked)

### ✅ Already Using Cache Invalidation (4 files)
1. ✅ app/admin/athletes/new/page.tsx - Uses `refetchQueries` (line 94)
2. ✅ app/clubs/[clubSlug]/parent/athletes/new/page.tsx - Uses `refetchQueries` (line 130)  
3. ✅ app/admin/coaches/[coachId]/assign/page.tsx - Uses `invalidateQueries` (already fixed)
4. ✅ app/clubs/[clubSlug]/admin/coaches/[coachId]/assign/page.tsx - Uses `invalidateQueries` (already fixed)

### ❌ NO Cache Invalidation (14 files) - MUST FIX

#### Sub-programs (2 files)
5. ❌ app/admin/sub-programs/[subProgramId]/edit/page.tsx
6. ❌ app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/edit/page.tsx

#### Groups (1 file)
7. ❌ app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/groups/new/page.tsx

#### Settings - Branding (2 files)
8. ❌ app/admin/settings/branding/page.tsx
9. ❌ app/clubs/[clubSlug]/admin/settings/branding/page.tsx

#### Settings - Seasons (2 files)  
10. ❌ app/admin/settings/seasons/page.tsx
11. ❌ app/clubs/[clubSlug]/admin/settings/seasons/page.tsx

#### Profile (4 files)
12. ❌ app/admin/profile/page.tsx
13. ❌ app/clubs/[clubSlug]/admin/profile/page.tsx
14. ❌ app/coach/profile/page.tsx
15. ❌ app/clubs/[clubSlug]/parent/profile/page.tsx

#### Cart (1 file)
16. ❌ app/clubs/[clubSlug]/parent/cart/page.tsx

#### System Admin (2 files)
17. ❌ app/system-admin/clubs/new/page.tsx
18. ❌ app/system-admin/clubs/[clubId]/edit/page.tsx

## Fix Strategy

### Phase 1: Upgrade Existing (2 files)
- Change `refetchQueries` → `invalidateQueries` for best practices
- Files: athlete pages (admin & parent)

### Phase 2: Add Missing (14 files)
For each file:
1. Import `useQueryClient` from '@tanstack/react-query'
2. Add `const queryClient = useQueryClient()`
3. After successful mutation, add appropriate `invalidateQueries` call

### Query Keys to Use
- Sub-programs: `['sub-programs', programId, seasonId]` + `['programs', seasonId, true]`
- Groups: `['sub-programs', programId, seasonId]`
- Seasons: Already has mutation hooks in use-season
- Branding: Need to check what updates (likely club data)
- Profile: Need to refresh auth context
- Cart: `['orders', householdId, seasonId]` + `['registrations', seasonId]`
- Clubs: Need to check if there's a clubs query key

## Total Files to Fix: 16
- 2 to upgrade (refetchQueries → invalidateQueries)
- 14 to add new cache invalidation
