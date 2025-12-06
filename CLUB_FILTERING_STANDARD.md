# Club Filtering Standard - Implementation Guide

## Standard Pattern for All Admin Pages

All admin pages should follow this pattern to ensure consistent club filtering.

### 1. Use the Standard Hook

```typescript
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery } from '@/lib/supabase-helpers'

export default function SomePage() {
  const router = useRouter()
  const { clubId, profile, loading: authLoading, error: authError } = useAdminClub()
  
  // Your component state...
  
  useEffect(() => {
    async function load() {
      // Wait for auth to complete
      if (authLoading || !clubId) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      // Use clubQuery for all database queries
      const { data, error } = await clubQuery(
        supabase.from('table').select('*'),
        clubId
      )
      
      // Handle data...
    }
    
    load()
  }, [router, clubId, authLoading, authError])
}
```

### 2. For Creating/Updating Records

```typescript
import { withClubData, getCurrentSeason } from '@/lib/supabase-helpers'

// When creating a new record
const season = await getCurrentSeason(clubId!)
if (!season) {
  setError('No current season found')
  return
}

const { error } = await supabase
  .from('programs')
  .insert(
    withClubData(
      { name, description, status: ProgramStatus.ACTIVE },
      clubId,
      season.id
    )
  )
```

### 3. Standard Loading/Error States

```typescript
if (authLoading || loading) {
  return <LoadingState />
}

if (error || authError) {
  return <ErrorState error={error || authError} />
}
```

## What `useAdminClub` Provides

- ✅ **Authentication check** - Redirects to login if not authenticated
- ✅ **Admin role check** - Redirects to dashboard if not admin
- ✅ **Club ID** - Gets from context or profile
- ✅ **Error handling** - Standardized error messages
- ✅ **Loading states** - Handles async club loading

## What `clubQuery` Does

- ✅ **Adds `.eq('club_id', clubId)`** to any query
- ✅ **Validates clubId exists** - Throws error if missing
- ✅ **Works with all Supabase query methods** - select, insert, update, delete

## Pages Updated

- ✅ `app/admin/page.tsx` - Dashboard
- ✅ `app/admin/programs/page.tsx` - Programs list
- ✅ `app/admin/programs/new/page.tsx` - New program (includes club_id + season_id)
- ✅ `app/admin/athletes/page.tsx` - Athletes list
- ✅ `app/admin/coaches/page.tsx` - Coaches list
- ✅ `app/admin/registrations/page.tsx` - Registrations list
- ✅ `app/admin/reports/page.tsx` - Reports
- ✅ `app/admin/programs/[programId]/sub-programs/page.tsx` - Sub-programs list

## Pages Still Need Updates

- [ ] `app/admin/programs/[programId]/edit/page.tsx`
- [ ] `app/admin/programs/[programId]/sub-programs/new/page.tsx`
- [ ] `app/admin/sub-programs/[subProgramId]/edit/page.tsx`
- [ ] `app/admin/sub-programs/[subProgramId]/groups/page.tsx`
- [ ] `app/admin/athletes/new/page.tsx`
- [ ] `app/admin/coaches/new/page.tsx`
- [ ] `app/admin/programs/sub-programs/[subProgramId]/edit/page.tsx`

## Benefits

1. **Consistency** - All pages use the same pattern
2. **Security** - Automatic club filtering prevents data leakage
3. **Less Code** - Reusable hook eliminates duplicate auth logic
4. **Maintainability** - Change auth logic in one place

## Quick Checklist for New Pages

- [ ] Import `useAdminClub` and `clubQuery`
- [ ] Use `const { clubId, profile, loading, error } = useAdminClub()`
- [ ] Wait for `authLoading` to finish before querying
- [ ] Wrap all queries with `clubQuery(query, clubId)`
- [ ] Use `withClubData()` when creating records
- [ ] Handle `authError` in error states

