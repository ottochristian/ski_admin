# Sign Out Fix - Immediate Redirect Issue

## Problem

**Symptom:** Clicking "Sign Out" required clicking twice or refreshing the page to actually sign out.

**Root Cause:** Using `router.push('/login')` for client-side navigation after clearing auth state didn't work reliably because:
1. React Query cache clearing happened synchronously before navigation
2. Client-side routing can get stuck when auth state changes
3. SSR components might not refresh properly with client-side routing

---

## Solution

**Changed:** `router.push('/login')` → `window.location.href = '/login'`

**Why This Works:**
- Forces a **full page reload** instead of client-side navigation
- All React state is completely cleared
- Server components re-render with no session
- No client-side routing cache issues

---

## Files Modified

### `lib/auth-context.tsx` - `signOut()` function

**Before:**
```typescript
const signOut = async () => {
  try {
    queryClient.clear()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/login')  // ❌ Client-side navigation (unreliable)
  } catch (err) {
    console.error('Sign out error:', err)
    throw err
  }
}
```

**After:**
```typescript
const signOut = async () => {
  try {
    queryClient.clear()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    window.location.href = '/login'  // ✅ Full page reload (reliable)
  } catch (err) {
    console.error('Sign out error:', err)
    throw err
  }
}
```

---

## Testing

✅ **Verified:** Sign out now works immediately on first click
✅ **No Refresh Required:** User is redirected to login page instantly
✅ **Clean State:** All auth state and React Query cache properly cleared

---

## Related

This is a common pattern in Next.js apps with SSR when dealing with auth state changes that affect server components. Using `window.location.href` ensures the entire app re-initializes with the new auth state.

---

**Fixed:** December 31, 2024  
**Status:** ✅ Complete & Verified
