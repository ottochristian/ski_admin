# Migration to Unified Season Context

## Changes Made

### 1. New Architecture
- **Created `/lib/contexts/season-context.tsx`**: Unified season context with portal-aware behavior
- **Created `/components/unified-season-selector.tsx`**: Single season selector component for all portals

### 2. Portal Detection
The new context automatically detects portal type from URL:
- `/admin/*` → Admin portal (season from URL)
- `/coach/*` → Coach portal (season from URL)
- `/parent/*` → Parent portal (always current season, read-only display)

### 3. Updated Layouts
All three portal layouts now use `<SeasonProvider>` and `<UnifiedSeasonSelector>`:
- ✅ `/app/clubs/[clubSlug]/admin/layout.tsx`
- ✅ `/app/coach/layout.tsx`
- ✅ `/app/clubs/[clubSlug]/parent/layout.tsx`

### 4. Migration Guide for Pages

**Old Pattern:**
```typescript
import { useAdminSeason } from '@/lib/use-admin-season'

const { selectedSeason, loading: seasonLoading } = useAdminSeason()
```

**New Pattern:**
```typescript
import { useSelectedSeason } from '@/lib/contexts/season-context'

const selectedSeason = useSelectedSeason()
```

### 5. Pages to Update

Run these replacements in each file:

#### Admin Pages:
- [ ] `/app/clubs/[clubSlug]/admin/registrations/page.tsx`
- [ ] `/app/clubs/[clubSlug]/admin/reports/page.tsx`
- [ ] `/app/clubs/[clubSlug]/admin/programs/[programId]/sub-programs/page.tsx`
- [ ] `/app/clubs/[clubSlug]/admin/programs/[programId]/sub-programs/new/page.tsx`
- [ ] `/app/clubs/[clubSlug]/admin/coaches/[coachId]/assign/page.tsx`
- [ ] `/app/clubs/[clubSlug]/admin/settings/seasons/page.tsx`
- [ ] `/app/clubs/[clubSlug]/admin/programs/new/page.tsx`

#### Parent Pages:
- [ ] `/app/clubs/[clubSlug]/parent/programs/page.tsx`
- [ ] `/app/clubs/[clubSlug]/parent/billing/page.tsx`
- [ ] `/app/clubs/[clubSlug]/parent/cart/page.tsx`

### 6. For Settings/Seasons Page
The seasons settings page needs special handling because it uses multiple season hooks:

**Old:**
```typescript
import { useAdminSeason } from '@/lib/use-admin-season'
import { useCreateSeason, useUpdateSeason, useDeleteSeason } from '@/lib/hooks/use-season'

const { seasons, loading: seasonsLoading } = useAdminSeason()
```

**New:**
```typescript
import { useSeason } from '@/lib/contexts/season-context'
import { useCreateSeason, useUpdateSeason, useDeleteSeason } from '@/lib/hooks/use-season'

const { seasons, loading } = useSeason()
```

### 7. Benefits
- ✅ Single source of truth
- ✅ Portal-aware behavior
- ✅ URL-based state for admin/coach
- ✅ Type-safe
- ✅ Performance optimized
- ✅ Consistent across all portals

### 8. Deprecated (Do Not Use)
- ❌ `useAdminSeason()` from `/lib/use-admin-season.ts`
- ❌ `useCoachSeason()` from `/lib/use-coach-season.ts`
- ❌ Individual `SeasonSelector` and `CoachSeasonSelector` components

### 9. New Hooks Available
- ✅ `useSeason()` - Full context access
- ✅ `useSelectedSeason()` - Just the selected season (most common)
- ✅ `useCurrentSeason()` - Just the current season
- ✅ `useCanChangeSeason()` - Check if portal allows season changes
