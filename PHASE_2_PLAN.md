# Phase 2: Simplify Data Layer (RLS Focus)

## Goal
Remove redundant manual club filtering and rely on RLS policies as the source of truth for data security.

## Current State
- **24 files** use `clubQuery` or `withClubFilter` for manual club filtering
- Manual filtering is redundant if RLS policies properly scope data
- Mix of manual filtering + RLS creates confusion about security model

## Phase 2 Tasks

### 1. Audit RLS Policies ✅
- Review all RLS policies for programs, athletes, coaches, registrations, etc.
- Ensure policies automatically filter by `club_id` based on user's profile
- Document which tables have proper RLS and which need updates

### 2. Test RLS Functionality ✅
- Create test queries without manual `club_id` filtering
- Verify RLS automatically restricts data to user's club
- Test edge cases (system admins, cross-club access, etc.)

### 3. Remove Manual Filtering ✅
- Remove `clubQuery`/`withClubFilter` from client code where RLS handles it
- Keep manual filtering only for admin client (bypasses RLS)
- Update service layer to remove redundant filters

### 4. Consolidate Hooks ✅
- Refactor `useAdminClub` to use base `useAuth()` from Phase 1
- Refactor `useParentClub` to use base `useAuth()`
- Create base `useSeason()` hook
- Remove duplicate authentication logic

### 5. Update Documentation ✅
- Update CLUB_FILTERING guides to reflect RLS-first approach
- Document which queries need manual filtering (admin operations)
- Update service layer documentation

## Files to Update

### Remove Manual Filtering From:
- `app/admin/page.tsx` - Dashboard
- `app/admin/programs/page.tsx` - Programs list
- `app/admin/athletes/page.tsx` - Athletes list
- `app/admin/coaches/page.tsx` - Coaches list
- `app/admin/registrations/page.tsx` - Registrations
- All other admin pages using `clubQuery`

### Update Service Layer:
- `lib/services/programs-service.ts` - Remove manual club filtering
- `lib/services/` - All services should rely on RLS

### Consolidate Hooks:
- `lib/use-admin-club.ts` - Use base `useAuth()`
- `lib/use-parent-club.ts` - Use base `useAuth()`
- `lib/use-admin-season.ts` - Create base `useSeason()`
- `lib/use-coach-season.ts` - Use base `useSeason()`

## Success Criteria

- [ ] All RLS policies verified and working
- [ ] Manual `clubQuery` removed from client code (except admin client)
- [ ] Hooks refactored to use base hooks
- [ ] Zero redundant club filtering in service layer
- [ ] Tests confirm RLS automatically scopes data

## Notes

- Keep `withClubData()` helper for INSERT operations (still need to set club_id)
- Admin client operations may still need manual filtering (bypasses RLS)
- This is a security-critical phase - test thoroughly before removing filters


