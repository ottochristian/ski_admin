# Comprehensive Cache Invalidation Fix Plan

## Query Keys Reference (from hooks)
```typescript
['athletes'] // All athletes
['athletes', 'household', householdId] // Household athletes
['athletes', 'count'] // Athlete count
['coaches', includeAssignments] // Coaches list
['coach', coachId] // Single coach
['programs', seasonId?, includeSubPrograms?] // Programs list
['program', programId] // Single program
['sub-programs', programId, seasonId] // Sub-programs for a program
['seasons', clubId?] // Seasons list
['season', seasonId] // Single season
['households'] // Households list
['orders', householdId, seasonId] // Orders
['registrations', seasonId] // Registrations
['registrations', 'recent', seasonId, limit] // Recent registrations
['registrations', 'count', seasonId] // Registration count
['registrations', 'revenue', seasonId] // Registration revenue
```

## Files to Fix (20 total)

### ✅ Already Fixed (2)
1. ✅ app/admin/coaches/[coachId]/assign/page.tsx
2. ✅ app/clubs/[clubSlug]/admin/coaches/[coachId]/assign/page.tsx

### 🔧 To Fix (18)

#### Athletes (2 files)
3. app/admin/athletes/new/page.tsx
   - Invalidate: `['athletes']`
   
4. app/clubs/[clubSlug]/parent/athletes/new/page.tsx
   - Invalidate: `['athletes']`, `['athletes', 'household', householdId]`

#### Programs (Already has mutations in hook - check if pages use them)
5. app/clubs/[clubSlug]/admin/programs/page.tsx
   - Check if using mutation hooks or manual saves

#### Sub-programs (2 files)
6. app/admin/sub-programs/[subProgramId]/edit/page.tsx
   - Invalidate: `['sub-programs', programId, seasonId]`, `['programs', seasonId, true]`

7. app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/edit/page.tsx
   - Invalidate: `['sub-programs', programId, seasonId]`, `['programs', seasonId, true]`

#### Groups (1 file)
8. app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/groups/new/page.tsx
   - Invalidate: `['sub-programs', programId, seasonId]` (groups are nested in sub-programs)

#### Settings - Seasons (2 files)
9. app/admin/settings/seasons/page.tsx
   - Check if using mutation hooks from use-season (already has invalidation)
   
10. app/clubs/[clubSlug]/admin/settings/seasons/page.tsx
   - Check if using mutation hooks from use-season (already has invalidation)

#### Settings - Branding (2 files)  
11. app/admin/settings/branding/page.tsx
   - Invalidate: need to check what this updates (club profile?)

12. app/clubs/[clubSlug]/admin/settings/branding/page.tsx
   - Invalidate: need to check what this updates (club profile?)

#### Profile Pages (3 files)
13. app/admin/profile/page.tsx
   - Invalidate: might need to refresh auth context

14. app/clubs/[clubSlug]/admin/profile/page.tsx
   - Invalidate: might need to refresh auth context

15. app/coach/profile/page.tsx
   - Invalidate: might need to refresh auth context
   
16. app/clubs/[clubSlug]/parent/profile/page.tsx
   - Invalidate: might need to refresh auth context

#### Cart (1 file)
17. app/clubs/[clubSlug]/parent/cart/page.tsx
   - Invalidate: `['orders', householdId, seasonId]`, `['registrations', seasonId]`

#### System Admin - Clubs (2 files)
18. app/system-admin/clubs/new/page.tsx
   - Invalidate: clubs list (need to check if there's a hook)

19. app/system-admin/clubs/[clubId]/edit/page.tsx
   - Invalidate: clubs list

#### Signup (1 file)
20. app/signup/page.tsx
   - Check what this updates (probably doesn't need cache invalidation)

## Fix Order (Priority)
1. **Athletes** (new pages) - High user impact
2. **Sub-programs & Groups** (edit/new) - High user impact  
3. **Settings** pages - Medium impact
4. **Profile** pages - Medium impact
5. **Cart** - Medium impact
6. **System Admin** - Low impact (admin-only)
7. **Signup** - Audit only

## Implementation Strategy
For each file:
1. Import `useQueryClient` from '@tanstack/react-query'
2. Call `const queryClient = useQueryClient()`
3. After successful mutation, call appropriate `invalidateQueries`
4. Test that UI updates without refresh
