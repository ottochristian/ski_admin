# Phase 3: Security & Route Consolidation Plan

## 🎯 Overview

Phase 3 combines **critical security hardening** (from `NEXT_STEPS_PRIORITIZED.md`) with **route consolidation & type system** (from `CODEBASE_AUDIT_AND_RESTRUCTURE_PLAN.md`) in a prioritized order.

**Rationale:** Security hardening is critical for production readiness, but route consolidation is important for maintainability. We'll do both, starting with security.

---

## 🔒 Part 1: Security Hardening (Week 1) - HIGHEST PRIORITY

### Why First?
- **Production Risk:** Incomplete Supabase client migration = session/auth issues
- **Security:** No input validation = injection attacks possible
- **Visibility:** No error monitoring = blind to production issues

These are **blockers** for production launch.

### 1. Complete Supabase Client Migration
**Time:** 4-6 hours  
**Risk:** Low (can be done incrementally)  
**Impact:** High - Better security & reliability

**Current State:**
- ~41 files still using `@/lib/supabaseClient` (browser client)
- Only a few files migrated to SSR client (`createServerSupabaseClient`)
- API routes need server client for proper session handling

**Tasks:**
- [ ] Audit all files using `supabaseClient`
- [ ] Migrate API routes first (highest priority)
- [ ] Migrate server components/actions
- [ ] Migrate client components (lower priority, can use browser client)
- [ ] Test each migration incrementally

**Files to Migrate (Priority Order):**
1. **API Routes** (~10 files) - Critical for session handling
   - `app/api/**/*.ts`
2. **Server Components** (if any)
3. **Client Components** (~30 files) - Can stay with browser client for now

---

### 2. Add Input Validation & Sanitization
**Time:** 2-3 hours  
**Risk:** Low  
**Impact:** Medium-High - Security improvement

**Create `lib/validation.ts`:**
```typescript
import { z } from 'zod'

// Common schemas
export const emailSchema = z.string().email()
export const uuidSchema = z.string().uuid()
export const clubSlugSchema = z.string().regex(/^[a-z0-9-]+$/)

// API request schemas
export const createAthleteSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().optional(),
  household_id: uuidSchema,
})

// Use in API routes
export async function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
  return schema.parse(data)
}
```

**Apply to:**
- All API routes accepting POST/PUT data
- Form submissions
- URL parameters (clubSlug, IDs)

---

### 3. Set Up Error Monitoring (Sentry)
**Time:** 1-2 hours  
**Risk:** None  
**Impact:** High - Visibility into production issues

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Why:** Essential for production - you can't fix what you don't know about.

**Configuration:**
- Client-side error tracking
- Server-side error tracking
- API route errors
- Performance monitoring

---

## 🛣️ Part 2: Route Consolidation (Week 2) - Option A

### Why Second?
- Not blocking production launch
- Important for maintainability and developer experience
- Makes multi-club support cleaner

### Goal: Fully Club-Aware Routes

**Decision:** Option A - All routes use `/clubs/[clubSlug]/...` pattern

### Current State:
- **Legacy routes:** `/admin`, `/coach`, `/dashboard` (with redirects)
- **Club-aware routes:** `/clubs/[clubSlug]/parent/...` ✅ (fully implemented)
- **Mixed state:** Admin pages use legacy routes with redirects

### Tasks:

#### 1. Move Admin Pages to Club-Aware Routes
**Time:** 4-6 hours

**Create new route structure:**
```
app/clubs/[clubSlug]/admin/
  ├── page.tsx (dashboard)
  ├── athletes/
  │   ├── page.tsx
  │   └── new/page.tsx
  ├── coaches/
  │   ├── page.tsx
  │   ├── new/page.tsx
  │   └── [coachId]/assign/page.tsx
  ├── programs/
  │   ├── page.tsx
  │   ├── new/page.tsx
  │   └── [programId]/
  │       ├── edit/page.tsx
  │       └── sub-programs/
  ├── registrations/page.tsx
  ├── reports/page.tsx
  └── settings/
      ├── seasons/page.tsx
      └── branding/page.tsx
```

**Migration Steps:**
1. Create new routes under `/clubs/[clubSlug]/admin/`
2. Copy/update pages to use club from URL params
3. Update all internal links
4. Update middleware to redirect `/admin` → `/clubs/[slug]/admin`
5. Remove old `/admin` routes (or keep as redirect-only)

#### 2. Update All Navigation & Links
**Time:** 2-3 hours

- [ ] Update admin sidebar components
- [ ] Update breadcrumbs
- [ ] Update all `Link` components
- [ ] Update all `router.push()` calls
- [ ] Update redirects in layouts

#### 3. Consolidate Redirect Logic
**Time:** 1-2 hours

- [ ] Move all redirects to `middleware.ts`
- [ ] Remove redirect logic from layouts
- [ ] Remove `app/dashboard/page.tsx` (handle in middleware)
- [ ] Simplify `app/page.tsx`

**Files Affected:**
- `app/admin/**` → Move to `app/clubs/[clubSlug]/admin/**`
- `middleware.ts` → Add redirect logic
- `app/dashboard/page.tsx` → Remove or simplify
- All navigation components
- All internal links

---

## 📦 Part 3: Type System Overhaul (Week 2-3)

### Goal: Comprehensive, Centralized Type System

### Current State:
- `lib/types.ts` has only 5 basic interfaces
- Many types defined inline in components/hooks
- No types generated from Supabase schema

### Tasks:

#### 1. Generate Types from Supabase Schema
**Time:** 1 hour

```bash
# Install Supabase CLI (if not already)
npm install -g supabase

# Generate types
supabase gen types typescript --project-id <project-id> > lib/types/database.ts
```

**Or manually create** comprehensive types matching database schema.

#### 2. Create Type Structure
**Time:** 2-3 hours

**Create `lib/types/` directory:**
```
lib/types/
  ├── database.ts       # Generated from Supabase schema
  ├── api.ts            # API request/response types
  ├── components.ts     # Component prop types
  └── index.ts          # Re-exports
```

#### 3. Migrate Inline Types
**Time:** 4-6 hours

- [ ] Move `Household`, `Athlete` from `use-parent-club.ts`
- [ ] Move `Season` from `use-season.ts`
- [ ] Move `CoachAssignment` types
- [ ] Move service response types
- [ ] Update all imports

**Files Affected:**
- `lib/types.ts` → Expand to directory
- `lib/use-parent-club.ts`
- `lib/hooks/use-season.ts`
- `lib/services/**`
- `app/api/**`
- All pages with inline types

#### 4. Fix Type Safety Issues
**Time:** 2-3 hours

- [ ] Remove all `any` types
- [ ] Add proper return types to services
- [ ] Type all API routes
- [ ] Fix TypeScript errors

---

## 📊 Timeline

### Week 1: Security Hardening (CRITICAL)
- Day 1-2: Supabase client migration (API routes)
- Day 3: Input validation setup
- Day 4: Error monitoring (Sentry)
- Day 5: Testing & fixes

### Week 2: Route Consolidation + Type System Start
- Day 1-3: Move admin pages to club-aware routes
- Day 4-5: Update navigation & consolidate redirects
- Start: Generate types from schema

### Week 3: Type System Completion
- Day 1-2: Create type structure & migrate inline types
- Day 3-4: Fix type safety issues
- Day 5: Testing & cleanup

**Total: ~2-3 weeks**

---

## 🎯 Success Metrics

### Security Hardening
- [ ] 100% of API routes use SSR client
- [ ] All API routes have input validation
- [ ] Error monitoring active (Sentry dashboard)
- [ ] Zero unvalidated user input

### Route Consolidation
- [ ] All routes follow `/clubs/[clubSlug]/...` pattern
- [ ] Zero redirect pages (or all in middleware)
- [ ] All navigation uses canonical routes
- [ ] Cleaner, more maintainable routing

### Type System
- [ ] Types generated from Supabase schema
- [ ] Zero inline type definitions
- [ ] 100% TypeScript coverage (no `any`)
- [ ] All imports use centralized types

---

## 🚨 Priority Decision

**If time is limited, do in this order:**
1. ✅ **Security Hardening** (MUST HAVE for production)
2. ⚠️ **Route Consolidation** (SHOULD HAVE for maintainability)
3. ⚠️ **Type System** (NICE TO HAVE, but important long-term)

**Recommendation:** Do all three, but security hardening is non-negotiable for production.

---

## 🔄 Integration with Phase 2

Phase 3 builds on Phase 2's foundation:
- ✅ RLS policies are in place (security at database level)
- ✅ Service layer established (ready for type system)
- ✅ React Query hooks created (ready for route consolidation)
- ✅ Base auth hooks created (simplifies route protection)

---

**Next Steps:**
1. Review and approve this plan
2. Start with Part 1: Security Hardening
3. Proceed to Part 2 & 3 in parallel or sequentially based on priorities
