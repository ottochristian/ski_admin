# Performance Issues After Phase 1 & 2 Refactor

## Issues Identified

### 1. **React Query Cache Too Aggressive**
- `staleTime: 30 seconds` - Data becomes stale too quickly, causing unnecessary refetches
- Should be 5-10 minutes for most data

### 2. **ClubContext Queries on Every Navigation**
- `ClubContext` runs `getUser()` + profile query + club query on EVERY pathname change
- Even if navigating between pages in the same club (e.g., `/clubs/jackson/admin/programs` → `/clubs/jackson/admin/athletes`)
- Club data doesn't change, so this is wasteful

### 3. **Multiple Redundant Queries**
- **Middleware**: Calls `getUser()` + profile query on every request
- **ClubContext**: Calls `getUser()` + profile query + club query
- **Individual pages**: May also call `getUser()` or profile queries
- **AuthContext**: Likely also calls `getUser()`

Result: 3-4 duplicate `getUser()` calls per page load!

### 4. **ClubContext Not Using React Query**
- ClubContext uses raw Supabase queries instead of React Query
- Can't benefit from React Query's caching and deduplication
- No memoization across page navigations

### 5. **No Query Deduplication**
- If multiple components need the same data, they each make separate queries
- React Query should handle this, but ClubContext bypasses it

## Fixes Applied ✅

### ✅ Priority 1: Increased React Query staleTime
- Changed from 30s to **5 minutes** for all queries
- Added `refetchOnMount: false` to prevent refetches on navigation
- This means data stays fresh for 5 minutes, dramatically reducing API calls

### ✅ Priority 2: Optimized ClubContext
- **Only reloads club if clubSlug actually changed** (not on every pathname change)
- Tracks `currentClubSlug` to avoid unnecessary reloads
- Navigations within the same club (e.g., `/clubs/jackson/admin/programs` → `/clubs/jackson/admin/athletes`) no longer trigger club reloads

### ✅ Priority 3: Optimized Middleware
- Added `.json` to static asset patterns to skip middleware for JSON files

## Remaining Optimizations (Optional)

### Priority 4: Further ClubContext Optimization
- Consider using React Query for club data to benefit from global cache
- Currently uses raw state which works but doesn't share cache across components

### Priority 5: Reduce Duplicate Auth Checks
- ClubContext could use AuthContext's profile instead of calling getUser() again
- This would eliminate one getUser() call per page load

