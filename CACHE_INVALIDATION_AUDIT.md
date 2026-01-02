# Cache Invalidation Audit

## Problem
Multiple pages save data to the database but don't invalidate React Query cache, causing stale UI data that requires manual page refresh.

## Pattern to Fix
After successful save/update/delete operations, call:
```typescript
await queryClient.invalidateQueries({ queryKey: ['entity-name', ...params] })
```

## Query Keys Reference
Based on hooks in `lib/hooks/`:

- **Athletes**: `['athletes', clubId?, seasonId?]`
- **Coaches**: `['coaches', includeAssignments]`
- **Programs**: `['programs', seasonId?, includeSubPrograms?]`
- **Sub-programs**: `['sub-programs', programId]`
- **Groups**: `['groups', subProgramId]`
- **Households**: `['households', clubId?]`
- **Registrations**: `['registrations', clubId?, seasonId?]`
- **Seasons**: `['seasons', clubId?]`

## Files Needing Fix

### ✅ Already Fixed
- ✅ `app/clubs/[clubSlug]/admin/coaches/[coachId]/assign/page.tsx` - invalidates `['coaches', true]`
- ✅ `app/admin/coaches/[coachId]/assign/page.tsx` - invalidates `['coaches', true]`

### ❌ Needs Fix (Imports useQueryClient but doesn't use invalidateQueries)

#### 1. Athletes - New
- **File**: `app/clubs/[clubSlug]/admin/athletes/new/page.tsx`
- **Imports**: ✓ useQueryClient (line 8)
- **Uses**: ✗ No invalidateQueries call
- **Fix needed**: After athlete creation, invalidate `['athletes']`

#### 2. Parent Athletes - New  
- **File**: `app/clubs/[clubSlug]/parent/athletes/new/page.tsx`
- **Imports**: ✓ useQueryClient (line 7)
- **Uses**: ✗ No invalidateQueries call
- **Fix needed**: After athlete creation, invalidate `['athletes']`

#### 3. Programs - New
- **File**: `app/clubs/[clubSlug]/admin/programs/new/page.tsx`
- **Imports**: ✓ useQueryClient (line 8)
- **Uses**: ✗ No invalidateQueries call
- **Fix needed**: After program creation, invalidate `['programs', seasonId]`

#### 4. Programs - Edit
- **File**: `app/clubs/[clubSlug]/admin/programs/[programId]/edit/page.tsx`
- **Imports**: ✓ useQueryClient (line 20)
- **Uses**: ✗ No invalidateQueries call
- **Fix needed**: After program update, invalidate `['programs', seasonId]`

### ❌ Needs Fix (Doesn't import useQueryClient at all)

#### 5. Sub-programs - Edit
- **File**: `app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/edit/page.tsx`
- **Imports**: ✗ No useQueryClient
- **Fix needed**: 
  1. Import useQueryClient
  2. After sub-program update, invalidate `['sub-programs', programId]` and `['programs', seasonId, true]`

#### 6. Groups - New
- **File**: `app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/groups/new/page.tsx`
- **Imports**: ✗ No useQueryClient
- **Fix needed**:
  1. Import useQueryClient
  2. After group creation, invalidate `['groups', subProgramId]`

#### 7. Sub-programs - List (if has create/delete)
- **File**: `app/clubs/[clubSlug]/admin/programs/[programId]/sub-programs/page.tsx`
- **Check**: Does it have inline create/delete? If yes, needs cache invalidation

#### 8. Groups - List (if has create/delete)
- **File**: `app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/groups/page.tsx`
- **Check**: Does it have inline create/delete? If yes, needs cache invalidation

## Other Potential Issues

### Check These Pages:
1. **System Admin**: `app/system-admin/clubs/new/page.tsx` - Club creation
2. **System Admin**: `app/system-admin/clubs/[clubId]/edit/page.tsx` - Club edit
3. **Settings**: Any settings pages that update data
4. **Profile pages**: Coach/Admin/Parent profile updates
5. **Registration**: Parent cart/registration flows

## Testing Checklist

For each fixed page, test:
1. ✓ Create/update entity
2. ✓ Click save/submit
3. ✓ Navigate back to list
4. ✓ New/updated data appears immediately
5. ✓ No manual refresh required

## Priority

**High Priority** (user-facing CRUD):
1. Athletes new/edit
2. Programs new/edit
3. Sub-programs new/edit
4. Groups new

**Medium Priority**:
- Settings pages
- Profile updates
- System admin pages

**Low Priority**:
- One-time setup flows
- Auth flows (already working)
