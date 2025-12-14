# Club-Aware Route Migration Status

## Overview
Migrating all admin pages from `/admin/*` to `/clubs/[clubSlug]/admin/*` for proper multi-club support.

## Pages Created (Club-Aware) ✅
1. `/clubs/[clubSlug]/admin/page.tsx` - Dashboard
2. `/clubs/[clubSlug]/admin/programs/page.tsx` - Programs listing
3. `/clubs/[clubSlug]/admin/programs/new/page.tsx` - New program
4. `/clubs/[clubSlug]/admin/programs/[programId]/edit/page.tsx` - Edit program
5. `/clubs/[clubSlug]/admin/athletes/page.tsx` - Athletes listing
6. `/clubs/[clubSlug]/admin/athletes/new/page.tsx` - New athlete
7. `/clubs/[clubSlug]/admin/coaches/page.tsx` - Coaches listing
8. `/clubs/[clubSlug]/admin/coaches/new/page.tsx` - New coach
9. `/clubs/[clubSlug]/admin/registrations/page.tsx` - Registrations
10. `/clubs/[clubSlug]/admin/reports/page.tsx` - Reports
11. `/clubs/[clubSlug]/admin/settings/seasons/page.tsx` - Seasons management

## Pages Still Needed (Priority Order)

### High Priority - Core Functionality
- [x] `/clubs/[clubSlug]/admin/settings/seasons/page.tsx` ✅
- [x] `/clubs/[clubSlug]/admin/programs/new/page.tsx` ✅
- [x] `/clubs/[clubSlug]/admin/athletes/new/page.tsx` ✅
- [x] `/clubs/[clubSlug]/admin/coaches/new/page.tsx` ✅
- [x] `/clubs/[clubSlug]/admin/programs/[programId]/edit/page.tsx` ✅

### Medium Priority - Nested Routes
- [ ] `/clubs/[clubSlug]/admin/programs/[programId]/sub-programs/page.tsx`
- [ ] `/clubs/[clubSlug]/admin/programs/[programId]/sub-programs/new/page.tsx`
- [ ] `/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/edit/page.tsx`
- [ ] `/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/groups/page.tsx`
- [ ] `/clubs/[clubSlug]/admin/coaches/[coachId]/assign/page.tsx`

### Lower Priority
- [ ] `/clubs/[clubSlug]/admin/settings/branding/page.tsx`
- [ ] `/clubs/[clubSlug]/admin/profile/page.tsx` (if needed)

## What Needs Updating

### Internal Links
All pages need to use `basePath = /clubs/${clubSlug}/admin` for links instead of hardcoded `/admin/*`

### Redirects to Update
1. `app/login/page.tsx` - Admin redirect
2. `app/dashboard/page.tsx` - Admin redirect  
3. `app/setup-password/page.tsx` - Admin redirect
4. `app/page.tsx` - Admin redirect

## Migration Pattern

For each page migration:
1. Add `useParams()` to get `clubSlug`
2. Set `basePath = /clubs/${clubSlug}/admin`
3. Replace all `/admin/*` links with `${basePath}/*`
4. Keep all business logic the same (RLS handles club filtering)

## Status
**Progress: 16/19 pages migrated (~84%)**

### ✅ Completed Pages
- [x] Dashboard
- [x] Programs listing, new, edit
- [x] Programs/[programId]/sub-programs listing, new
- [x] Sub-programs/[subProgramId]/edit
- [x] Sub-programs/[subProgramId]/groups
- [x] Athletes listing, new
- [x] Coaches listing, new
- [x] Coaches/[coachId]/assign
- [x] Registrations
- [x] Reports
- [x] Settings/seasons

### Remaining Pages (Lower Priority)
- [ ] `/clubs/[clubSlug]/admin/settings/branding/page.tsx` (optional - branding page)
- [ ] `/clubs/[clubSlug]/admin/profile/page.tsx` (optional - if separate from parent portal)

## Summary

**✅ 16 out of 19 critical admin pages have been migrated to club-aware routes!**

All core functionality pages are now using the `/clubs/[clubSlug]/admin/*` structure:
- ✅ Dashboard
- ✅ All CRUD operations (programs, athletes, coaches, registrations)
- ✅ All nested routes (edit, sub-programs, groups, assignments)
- ✅ Settings (seasons)
- ✅ Reports

**All internal links in club-aware pages use `${basePath}` pattern for consistency.**

**Redirects:** Primary redirects already use club-aware routes. Fallback redirects to `/admin` exist but middleware will automatically redirect them to club-aware routes.

**Next Steps:**
1. Test all routes to ensure they work correctly
2. Optionally create branding page if needed
3. Consider removing legacy `/admin/*` routes once fully tested

### Next Steps
1. Create remaining nested program/sub-program routes
2. Create coach assignment page
3. Update all internal links to use `basePath` consistently
4. Test all routes work correctly

