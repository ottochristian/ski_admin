# Pagination Implementation Example

This document shows how to add pagination to list pages. Use this as a template for updating other pages.

## Example: Registrations Page

### Before (Without Pagination)

```typescript
// ❌ BAD: Loads ALL registrations
const { data } = await clubQuery(
  supabase
    .from('registrations')
    .select('*')
    .eq('season_id', selectedSeason.id)
    .order('created_at', { ascending: false }),
  clubId
)
```

**Problems:**
- Loads potentially thousands of records
- Slow query time
- High memory usage
- Poor user experience

### After (With Pagination)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { parsePaginationParams, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination'
import { Pagination } from '@/components/ui/pagination'

export default function RegistrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const { selectedSeason, loading: seasonLoading } = useAdminSeason()
  
  // Parse pagination from URL
  const { page, pageSize } = parsePaginationParams(searchParams)
  const { from, to } = getPaginationRange(page, pageSize)
  
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRegistrations() {
      if (authLoading || seasonLoading || !clubId || !selectedSeason) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      try {
        // First, get total count for pagination metadata
        const { count, error: countError } = await clubQuery(
          supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', selectedSeason.id),
          clubId
        )

        if (countError) {
          setError(countError.message)
          setLoading(false)
          return
        }

        setTotalCount(count || 0)

        // Then, fetch paginated data
        const { data, error: registrationsError } = await clubQuery(
          supabase
            .from('registrations')
            .select(
              `
              id,
              athlete_id,
              sub_program_id,
              status,
              payment_status,
              amount_paid,
              created_at,
              season_id,
              athletes(id, first_name, last_name, date_of_birth),
              sub_programs(name, programs(name))
            `
            )
            .eq('season_id', selectedSeason.id)
            .order('created_at', { ascending: false })
            .range(from, to), // ✅ Add pagination range
          clubId
        )

        if (registrationsError) {
          setError(registrationsError.message)
          setLoading(false)
          return
        }

        // Transform data
        const transformedData = (data || []).map((reg: any) => ({
          ...reg,
          athlete: reg.athletes,
          program: reg.sub_programs?.programs || { name: reg.sub_programs?.name || 'Unknown' },
        }))

        setRegistrations(transformedData)
      } catch (err) {
        console.error('Error loading registrations:', err)
        setError('Failed to load registrations')
      } finally {
        setLoading(false)
      }
    }

    loadRegistrations()
  }, [router, clubId, authLoading, authError, selectedSeason, seasonLoading, page, pageSize])

  // Calculate pagination metadata
  const paginationMeta = calculatePaginationMeta(page, pageSize, totalCount)

  // Handle page change
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`?${params.toString()}`)
  }

  // ... rest of component

  return (
    <div className="flex flex-col gap-6">
      {/* Your existing table/content */}
      
      {/* Add pagination controls */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {from + 1} to {Math.min(to + 1, totalCount)} of {totalCount} registrations
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (paginationMeta.hasPrev) {
                      handlePageChange(page - 1)
                    }
                  }}
                  className={!paginationMeta.hasPrev ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              
              {/* Page numbers */}
              {Array.from({ length: paginationMeta.totalPages }, (_, i) => i + 1)
                .filter((pageNum) => {
                  // Show first, last, current, and pages around current
                  return (
                    pageNum === 1 ||
                    pageNum === paginationMeta.totalPages ||
                    Math.abs(pageNum - page) <= 1
                  )
                })
                .map((pageNum, idx, arr) => {
                  // Add ellipsis
                  const showEllipsis = idx > 0 && pageNum - arr[idx - 1] > 1
                  return (
                    <React.Fragment key={pageNum}>
                      {showEllipsis && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            handlePageChange(pageNum)
                          }}
                          isActive={pageNum === page}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    </React.Fragment>
                  )
                })}
              
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (paginationMeta.hasNext) {
                      handlePageChange(page + 1)
                    }
                  }}
                  className={!paginationMeta.hasNext ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
```

## Key Changes

1. **Parse pagination params from URL:**
   ```typescript
   const { page, pageSize } = parsePaginationParams(searchParams)
   const { from, to } = getPaginationRange(page, pageSize)
   ```

2. **Get total count:**
   ```typescript
   const { count } = await query.select('*', { count: 'exact', head: true })
   ```

3. **Add range to query:**
   ```typescript
   .range(from, to)
   ```

4. **Add pagination controls** at the bottom of the list

## Pages That Need Pagination

Update these pages following the same pattern:

- [ ] `app/admin/registrations/page.tsx`
- [ ] `app/admin/athletes/page.tsx`
- [ ] `app/admin/programs/page.tsx`
- [ ] `app/admin/coaches/page.tsx`
- [ ] `app/admin/reports/page.tsx` (if it lists data)
- [ ] `app/clubs/[clubSlug]/parent/programs/page.tsx`
- [ ] `app/clubs/[clubSlug]/parent/billing/page.tsx`
- [ ] Any other list pages

## Best Practices

1. **Default page size:** 50 items (configurable via URL)
2. **Max page size:** 100 items (enforced by `parsePaginationParams`)
3. **URL-based pagination:** Store page in URL query params for shareability
4. **Show item count:** "Showing X to Y of Z items"
5. **Efficient counting:** Use `{ count: 'exact', head: true }` to get count without data
6. **Indexed queries:** Ensure queries are indexed for fast pagination

## Performance Tips

- Index columns used in `WHERE` clauses
- Index columns used in `ORDER BY` clauses
- Use composite indexes for filtered + sorted queries
- Example index for registrations:
  ```sql
  CREATE INDEX idx_registrations_club_season_created 
    ON registrations(club_id, season_id, created_at DESC);
  ```
