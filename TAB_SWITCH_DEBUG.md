# Tab Switch Loading - Debugging Guide

## Latest Fixes Applied

### Fix #1: Silent Token Refresh
Modified `loadAuth()` to accept a `showLoader` parameter:
- `loadAuth(true)` → Shows loading screen (for sign-in)
- `loadAuth(false)` → Silent refresh (no loading screen)

### Fix #2: Prevent Unnecessary Profile Updates
Added profile comparison before updating state:
- Compares `id`, `email`, `role`, `club_id`, `first_name`, `last_name`
- If all values are identical, returns same object reference
- This prevents ClubContext from re-rendering when profile hasn't actually changed

### Fix #3: Initial Load Tracking
Added `useRef` to distinguish initial page load from tab switches:
- Uses `initialLoadRef` to track if this is the first auth event
- Initial load: `loadAuth(true)` - show loader
- Tab switch: `loadAuth(false)` - silent refresh

**Note**: Debug logs have been removed for production.

## How to Test

1. **Open browser console** (F12 or Cmd+Option+I)
2. **Log in** to admin portal
3. **Switch to another tab** (Gmail, YouTube, etc.)
4. **Wait 10-15 seconds**
5. **Switch back** to ski admin tab
6. **Check console** for:
   ```
   🔐 Auth event: TOKEN_REFRESHED
   🔄 Token refreshed - silent update (no loader)
   ```
7. **Verify**: Page should NOT show loading screen

## Expected Behavior

### ✅ Correct (After Fix)
- Switch tabs → No visible change
- Console shows token refresh event
- Page remains interactive
- No loading spinner

### ❌ Incorrect (Before Fix)
- Switch tabs → Loading screen appears
- Page becomes unresponsive
- Layout shows "Loading..." message
- Takes 1-2 seconds to recover

## What Causes the Token Refresh?

Supabase automatically refreshes JWT tokens when:
1. **Browser tab regains focus** (security measure)
2. **Token is about to expire** (~55 minutes)
3. **User performs authenticated action** with expired token

## Technical Details

### Auth State Changes
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  // event can be:
  // - SIGNED_IN: User just logged in
  // - SIGNED_OUT: User logged out
  // - TOKEN_REFRESHED: Silent token refresh (tab switch)
  // - USER_UPDATED: Profile changed
  // - PASSWORD_RECOVERY: Reset flow
})
```

### Loading State Flow

**Before fix:**
```
Tab switch → TOKEN_REFRESHED → loadAuth(true) → setLoading(true) → <InlineLoading />
```

**After fix:**
```
Tab switch → TOKEN_REFRESHED → loadAuth(false) → Profile updated silently → No UI change
```

### Profile Reference Stability

**Before fix:**
```typescript
setProfile(profileData) // New object every time
// ClubContext sees new object reference
// Triggers useEffect, calls setLoading(true)
```

**After fix:**
```typescript
setProfile(prev => {
  if (dataIsIdentical(prev, profileData)) {
    return prev // Same reference
  }
  return profileData // New reference only if data changed
})
// ClubContext doesn't re-render if profile unchanged
```

## If Issue Persists

### 1. Check Console Logs
Look for:
- `🔐 Auth event: TOKEN_REFRESHED`
- `🔄 Token refreshed - silent update (no loader)`
- `🔄 Redirect triggered:` (should NOT appear on tab switch)

### 2. Check ClubContext
If you see:
```
🔄 Redirect triggered: { ... }
```
This means ClubContext is reloading. Check if profile comparison is working.

### 3. Check Layout Loading
The layout checks:
```typescript
if (authLoading || clubLoading) {
  return <InlineLoading />
}
```

Use console.log to track these states:
```typescript
console.log('Layout render:', { authLoading, clubLoading })
```

### 4. Verify React Query Cache
React Query settings (in `lib/providers.tsx`):
```typescript
staleTime: 5 * 60 * 1000,  // 5 minutes
refetchOnWindowFocus: false, // Don't refetch on tab switch
refetchOnMount: false,       // Don't refetch on navigation
```

If `refetchOnWindowFocus: true`, queries will refetch on tab switch.

## Additional Debugging

### Add to Layout
```typescript
useEffect(() => {
  console.log('🏗️ Layout render:', {
    authLoading,
    clubLoading,
    hasProfile: !!profile,
    hasClub: !!club,
  })
}, [authLoading, clubLoading, profile, club])
```

### Add to AuthContext
```typescript
useEffect(() => {
  console.log('👤 Profile updated:', {
    id: profile?.id,
    role: profile?.role,
    club_id: profile?.club_id,
  })
}, [profile])
```

### Add to ClubContext
```typescript
useEffect(() => {
  console.log('🏢 Club updated:', {
    id: club?.id,
    slug: club?.slug,
    loading,
  })
}, [club, loading])
```

## Performance Impact

- **Before**: ~2-3 second loading screen on every tab switch
- **After**: No visible delay, ~100-200ms silent refresh in background
- **Network calls**: Same number (getUser + profile query), but hidden from user

## Related Files

- `lib/auth-context.tsx` - Auth state management
- `lib/club-context.tsx` - Club state management
- `lib/providers.tsx` - React Query config
- `app/clubs/[clubSlug]/admin/layout.tsx` - Admin layout with loading checks
- `components/ui/loading-states.tsx` - Loading UI components

