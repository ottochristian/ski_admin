# Code Updates Guide - Club-Aware System

## What We've Done

1. ✅ Created `ClubProvider` context to manage club state
2. ✅ Created `club-utils.ts` with helper functions
3. ✅ Updated root layout to include `ClubProvider`
4. ✅ Updated admin layout to get club and redirect if needed
5. ✅ Updated admin dashboard to filter by `club_id`
6. ✅ Updated programs page to filter by `club_id`
7. ✅ Created middleware (basic structure)

## What Still Needs Updating

### 1. All Admin Pages Need Club Filtering

Every admin page that queries the database needs to:
- Import `useClub` and `withClubFilter`
- Get `clubId` from context or profile
- Add `.eq('club_id', clubId)` to all queries

**Example pattern:**
```typescript
import { useClub } from '@/lib/club-context'
import { withClubFilter } from '@/lib/club-utils'

export default function SomePage() {
  const { club } = useClub()
  const [profile, setProfile] = useState<Profile | null>(null)
  
  useEffect(() => {
    // ... get profile ...
    const clubId = club?.id || profileData.club_id
    
    // OLD:
    // const { data } = await supabase.from('table').select('*')
    
    // NEW:
    const { data } = await withClubFilter(
      supabase.from('table').select('*'),
      clubId
    )
  }, [club])
}
```

### 2. Pages That Need Updates

- [ ] `app/admin/athletes/page.tsx`
- [ ] `app/admin/coaches/page.tsx`
- [ ] `app/admin/registrations/page.tsx`
- [ ] `app/admin/reports/page.tsx`
- [ ] `app/admin/programs/[programId]/edit/page.tsx`
- [ ] `app/admin/programs/[programId]/sub-programs/page.tsx`
- [ ] `app/admin/programs/[programId]/sub-programs/new/page.tsx`
- [ ] `app/admin/programs/new/page.tsx`
- [ ] `app/admin/sub-programs/[subProgramId]/edit/page.tsx`
- [ ] `app/admin/sub-programs/[subProgramId]/groups/page.tsx`
- [ ] `app/dashboard/page.tsx` (update families → households)
- [ ] `app/coach/page.tsx`

### 3. Create Club-Aware Routes (Optional)

You can create new routes like `/clubs/[clubSlug]/admin/...` but the current setup works with:
- Legacy routes (`/admin/...`) - automatically redirects to club-aware if club found
- Club-aware routes (`/clubs/[clubSlug]/admin/...`) - uses club from URL

### 4. Update Families → Households

Pages using `families` table need to use `households`:
- `app/dashboard/page.tsx` - Change `families` → `households`
- `components/family-setup-form.tsx` - Update to use households
- `components/add-athlete-form.tsx` - Update `family_id` → `household_id`

### 5. Update Payment Logic

Pages using `registrations.amount_paid` should use `orders`/`payments`:
- `app/admin/registrations/page.tsx` - Show orders instead
- `app/admin/page.tsx` - Already updated to use orders (if you want)

## Quick Update Script Pattern

For each admin page, follow this pattern:

```typescript
// 1. Add imports
import { useClub } from '@/lib/club-context'
import { withClubFilter } from '@/lib/club-utils'

// 2. Get club in component
const { club } = useClub()

// 3. Get clubId in useEffect
const clubId = club?.id || profileData.club_id
if (!clubId) {
  setError('No club associated')
  return
}

// 4. Wrap queries
const { data } = await withClubFilter(
  supabase.from('table').select('*'),
  clubId
)
```

## Testing Checklist

After updating each page:
- [ ] Page loads without errors
- [ ] Data is filtered to user's club only
- [ ] No data from other clubs shows up
- [ ] Create/edit operations work
- [ ] Club context is available

## Next Steps

1. **Update remaining admin pages** (use the pattern above)
2. **Test thoroughly** - Make sure club filtering works
3. **Update families → households** in dashboard
4. **Add club selector** if users belong to multiple clubs (future)
5. **Add season filtering** (similar pattern, but filter by season_id)

