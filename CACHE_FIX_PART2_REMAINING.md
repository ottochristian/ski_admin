# Cache Invalidation Part 2 - Remaining Work

## Summary
Out of original 16 files needing fixes:
- ✅ **Part 1 Complete**: 5 files fixed (athletes, sub-programs, groups)
- ✅ **Already OK**: 5 files use existing refresh methods
- ❌ **Part 2 Remaining**: 6 files need fixes

## Files Already OK (No Action Needed - 5 files)
1. ✅ app/clubs/[clubSlug]/admin/settings/branding/page.tsx - Uses `refreshClub()`
2. ✅ app/admin/settings/branding/page.tsx - Uses `refreshClub()`
3. ✅ app/admin/profile/page.tsx - Uses `router.refresh()`
4. ✅ app/clubs/[clubSlug]/admin/profile/page.tsx - Uses `router.refresh()`
5. ✅ app/system-admin/clubs/[clubId]/edit/page.tsx - Uses `router.refresh()`

## Files Needing Fixes (6 files)

### 1-2. Settings - Seasons (2 files)
- app/admin/settings/seasons/page.tsx
- app/clubs/[clubSlug]/admin/settings/seasons/page.tsx
- **Action**: Check if using season mutation hooks (which have built-in invalidation)
- **If not**: Add manual invalidation for `['seasons']`

### 3. Coach Profile
- app/coach/profile/page.tsx
- **Action**: Add `router.refresh()` after profile update
- **Or**: Reload auth context

### 4. Parent Profile  
- app/clubs/[clubSlug]/parent/profile/page.tsx
- **Action**: Add `router.refresh()` after profile update
- **Or**: Reload auth context

### 5. Parent Cart
- app/clubs/[clubSlug]/parent/cart/page.tsx
- **Action**: Add invalidation for `['orders', householdId, seasonId]` and `['registrations', seasonId]`

### 6. System Admin - Clubs New
- app/system-admin/clubs/new/page.tsx
- **Action**: Add invalidation for clubs list (need to check if there's a clubs query key)

## Next Steps
1. Fix the 6 remaining files
2. Test each fixed page
3. Commit Part 2
4. Push all changes to main
5. Document complete solution

## Total Impact
- Original audit: 20 files with mutations
- Part 1: 5 files fixed ✅
- Already OK: 5 files ✅  
- Part 2: 6 files to fix
- Total coverage: 16/16 files = 100% ✅
