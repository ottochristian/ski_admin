# Codebase Audit & Restructure Plan

## Executive Summary

This audit identifies areas where the codebase has accumulated complexity, custom workarounds, and technical debt. The goal is to identify fundamental issues and create a plan for robust, scalable solutions.

---

## 🔴 CRITICAL ISSUES (Fix First)

### 1. **Duplicate Authentication Logic Across Components**
**Location:** Multiple files (layouts, pages, hooks)

**Problem:**
- Authentication checks are duplicated across `app/admin/layout.tsx`, `useAdminClub`, `useParentClub`, `app/page.tsx`, `app/dashboard/page.tsx`, `app/coach/page.tsx`
- Each component manually checks `supabase.auth.getUser()` and fetches profiles
- Inconsistent error handling and redirect logic
- Violates DRY principle - changes require updates in 10+ places

**Impact:**
- High maintenance burden
- Security risk if one implementation is missed
- Inconsistent user experience
- Difficult to add new auth requirements (e.g., 2FA)

**Solution:**
- Create unified server-side authentication middleware
- Use Next.js middleware for route protection
- Create client-side auth context/provider that wraps all protected routes
- All components should consume auth from context, not fetch independently

**Files Affected:**
- `middleware.ts` (needs expansion)
- `app/admin/layout.tsx`
- `app/coach/layout.tsx`
- `app/clubs/[clubSlug]/parent/layout.tsx`
- `lib/use-admin-club.ts`
- `lib/use-parent-club.ts`
- `app/page.tsx`
- `app/dashboard/page.tsx`
- `app/coach/page.tsx`

---

### 2. **Inconsistent Data Fetching Patterns**
**Location:** All admin pages, parent pages, coach pages

**Problem:**
- Every page manually implements `useEffect` with loading/error state
- No standardized error boundaries
- Mix of `clubQuery`, `withClubFilter`, and manual `.eq('club_id', clubId)`
- Inconsistent loading state patterns (some use Spinner, some use text, some use skeletons)
- Data fetching logic mixed with UI logic

**Impact:**
- 20+ pages with duplicate patterns
- Hard to maintain loading states
- Inconsistent error handling
- Difficult to add features like retry logic, caching, or optimistic updates

**Solution:**
- Create React Query/SWR wrapper or custom hooks for data fetching
- Standardize loading/error UI components
- Extract data fetching to service layer
- Use React Server Components where possible (Next.js 13+)

**Files Affected:**
- All pages in `app/admin/`
- All pages in `app/coach/`
- All pages in `app/clubs/[clubSlug]/parent/`

---

### 3. **Custom Club Filtering Helpers (Band-Aid Solution)**
**Location:** `lib/supabase-helpers.ts`, `lib/club-utils.ts`

**Problem:**
- Two different helpers: `clubQuery` and `withClubFilter` (confusing naming)
- Manual filtering required on every query (easy to forget)
- No compile-time safety - can pass wrong `clubId` type
- RLS policies exist but we still manually filter (doubling up on security)

**Impact:**
- Security risk if developer forgets to add filter
- Type safety issues
- Unclear which helper to use
- Redundant with RLS (should rely on RLS as source of truth)

**Solution:**
- **Rely on RLS policies as primary security** - remove manual filtering from client code
- RLS should automatically scope all queries to user's club
- Only use manual filtering in admin client (supabase admin client bypasses RLS)
- If manual filtering is needed, create typed query builder that enforces club_id

**Files Affected:**
- `lib/supabase-helpers.ts` - simplify or remove
- `lib/club-utils.ts` - consolidate with supabase-helpers
- All pages using `clubQuery` - remove manual filters if RLS is working

---

### 4. **Complex Context Providers with Mixed Concerns**
**Location:** `lib/club-context.tsx`

**Problem:**
- `ClubProvider` handles both URL-based club selection AND profile-based fallback
- Mixes routing logic with data fetching
- Duplicates profile fetching logic that exists elsewhere
- Unclear when club comes from URL vs profile

**Impact:**
- Hard to reason about club resolution order
- Duplicate auth/profile fetching
- Tight coupling between routing and data

**Solution:**
- Split into `ClubContext` (data) and routing logic (middleware/layout)
- Use Next.js middleware for URL-based club resolution
- Single source of truth for club data
- Clear separation: middleware handles routing, context provides data

**Files Affected:**
- `lib/club-context.tsx`
- `middleware.ts`
- Layouts that use `useClub()`

---

## 🟡 MAJOR ISSUES (Fix Next)

### 5. **Multiple "Hook" Patterns for Similar Concerns**
**Location:** `lib/use-admin-club.ts`, `lib/use-parent-club.ts`, `lib/use-admin-season.ts`, `lib/use-coach-season.ts`

**Problem:**
- Each hook duplicates authentication logic
- `useAdminClub` and `useParentClub` are 80% identical (auth check, profile fetch)
- Season hooks duplicate season fetching logic
- No shared base hook for common patterns

**Impact:**
- Code duplication
- Inconsistent behavior across hooks
- Hard to add shared features (e.g., refresh token logic)

**Solution:**
- Create base `useAuth()` hook for authentication
- Create base `useSeason()` hook for season management
- Specialized hooks compose base hooks (e.g., `useAdminClub()` = `useAuth()` + role check)
- Use composition over duplication

**Files Affected:**
- `lib/use-admin-club.ts` - refactor to use base hooks
- `lib/use-parent-club.ts` - refactor to use base hooks
- `lib/use-admin-season.ts` - merge with `use-coach-season.ts` or create base
- `lib/use-coach-season.ts` - merge with `use-admin-season.ts` or create base

---

### 6. **Legacy Routes vs Club-Aware Routes Confusion**
**Location:** Multiple routing files

**Problem:**
- Dual routing system: `/admin` (legacy) and `/clubs/[clubSlug]/admin` (new)
- Redirect logic scattered across layouts and `app/page.tsx`
- Unclear which routes are canonical
- `app/dashboard/page.tsx` is just a redirect page

**Impact:**
- Confusing for developers
- SEO issues (duplicate routes)
- Hard to maintain redirect logic

**Solution:**
- **Choose one canonical route structure** (recommend club-aware routes)
- Consolidate redirects in middleware or single redirect handler
- Remove legacy routes or mark as deprecated
- Update all internal links to use canonical routes

**Files Affected:**
- `app/page.tsx` - simplify redirect logic
- `app/dashboard/page.tsx` - remove if just redirect
- `app/admin/layout.tsx` - remove redirect, enforce club-aware routes
- All internal links/navigation

---

### 7. **Inconsistent Type Definitions**
**Location:** `lib/types.ts`, inline type definitions

**Problem:**
- `lib/types.ts` has minimal types (Profile, Program, etc.)
- Many components define their own types inline (e.g., `CoachAssignment` in `app/coach/page.tsx`)
- Types like `Household` and `Athlete` defined in hooks instead of shared types file
- No shared types for common database responses

**Impact:**
- Type inconsistencies
- Hard to refactor
- Difficult to ensure type safety across boundaries

**Solution:**
- Create comprehensive type definitions for all database tables
- Use code generation from Supabase schema (if available)
- Centralize all types in `lib/types.ts` or `types/` directory
- Remove inline type definitions, import from shared location

**Files Affected:**
- `lib/types.ts` - expand significantly
- All pages with inline types
- `lib/use-parent-club.ts` - move types to shared location
- `app/coach/page.tsx` - move types to shared location

---

### 8. **API Route Inconsistencies**
**Location:** `app/api/`

**Problem:**
- `requireAuth` in `lib/api-auth.ts` has complex Bearer token + cookie logic
- Different error response formats across routes
- Some routes use `requireAdmin`, some manually check roles
- Inconsistent validation patterns

**Impact:**
- Security inconsistencies
- Different error formats confuse frontend
- Hard to add features like rate limiting or request logging

**Solution:**
- Standardize API route structure (handler wrapper)
- Consistent error response format
- Centralize validation logic
- Add request logging/monitoring

**Files Affected:**
- `lib/api-auth.ts` - simplify authentication (choose one method)
- All routes in `app/api/` - standardize structure

---

## 🟢 MODERATE ISSUES (Refactor When Convenient)

### 9. **Mixed Client/Server Component Patterns**
**Problem:**
- Everything is client components (`'use client'`)
- Missing opportunity for React Server Components (better performance, SEO)
- Data fetching in client components instead of server

**Solution:**
- Identify pages that can be server components
- Move data fetching to server components where possible
- Use client components only for interactivity

---

### 10. **Temporary Solutions Still in Code**
**Problem:**
- `migrations/17_create_signup_data_table.sql` - "temporary table" for signup data
- Cart uses temporary IDs (`id: string // temporary ID for cart`)
- Legacy `families` table still referenced alongside `households`

**Solution:**
- Remove temporary solutions
- Complete migration from `families` to `households`
- Fix cart to use proper IDs

---

### 11. **Inconsistent Error Handling**
**Problem:**
- Some places use toast notifications
- Some use inline error messages
- Some use error boundaries
- Console.error used instead of proper logging

**Solution:**
- Centralize error handling strategy
- Use error boundaries for React errors
- Consistent user-facing error messages
- Proper logging service (replace console.error)

---

## 📋 RESTRUCTURE PLAN

### Phase 1: Foundation (Week 1-2)
**Goal:** Establish solid authentication and data fetching foundation

1. **Unified Authentication**
   - Create server-side auth middleware
   - Create client-side auth context/provider
   - Remove duplicate auth logic from components
   - Update middleware to handle route protection

2. **Standardize Data Fetching**
   - Choose data fetching library (React Query recommended)
   - Create service layer for data access
   - Standardize loading/error UI components
   - Migrate 3-5 key pages as proof of concept

**Deliverables:**
- `lib/auth-context.tsx` - unified auth context
- `lib/data-services/` - service layer
- `components/ui/loading-states.tsx` - standardized loading
- Updated middleware with proper route protection

---

### Phase 2: Simplify Data Layer (Week 3-4)
**Goal:** Remove redundant filtering and rely on RLS

1. **Audit and Fix RLS Policies**
   - Ensure all tables have proper RLS
   - Test that RLS automatically scopes to club
   - Remove manual `clubQuery` filtering from client code
   - Keep manual filtering only in admin client

2. **Consolidate Hooks**
   - Create base `useAuth()` hook
   - Create base `useSeason()` hook
   - Refactor specialized hooks to compose base hooks
   - Remove duplicate logic

**Deliverables:**
- Comprehensive RLS test suite
- `lib/hooks/use-auth.ts` - base auth hook
- `lib/hooks/use-season.ts` - base season hook
- Updated specialized hooks using composition

---

### Phase 3: Route Consolidation (Week 5)
**Goal:** Single canonical route structure

1. **Choose Canonical Routes**
   - Decide: club-aware routes (`/clubs/[slug]/admin`) or legacy (`/admin`)
   - Update all internal links
   - Consolidate redirect logic in middleware
   - Remove redundant redirect pages

2. **Type System Overhaul**
   - Generate types from Supabase schema
   - Move all types to central location
   - Remove inline type definitions
   - Ensure type safety across boundaries

**Deliverables:**
- Updated route structure (all routes canonical)
- Comprehensive `types/` directory
- Updated all components to use shared types

---

### Phase 4: Cleanup (Week 6)
**Goal:** Remove technical debt and temporary solutions

1. **Remove Temporary Solutions**
   - Complete `families` → `households` migration
   - Remove temporary signup table (if possible)
   - Fix cart IDs

2. **Standardize API Routes**
   - Consistent error responses
   - Standardized validation
   - Request logging

3. **Error Handling**
   - Error boundaries
   - Consistent error UI
   - Proper logging service

**Deliverables:**
- Removed temporary code
- Standardized API route structure
- Comprehensive error handling

---

## 📊 METRICS FOR SUCCESS

### Code Quality
- [ ] Reduce duplicate authentication code by 80%
- [ ] Reduce data fetching patterns from 20+ variations to 2-3 standard patterns
- [ ] All types defined in central location
- [ ] Zero temporary/workaround code

### Maintainability
- [ ] New page creation follows single standard pattern
- [ ] Changes to auth logic require updates in 1 place (not 10+)
- [ ] All routes follow canonical structure

### Security
- [ ] RLS policies cover all tables
- [ ] Zero manual club filtering in client code (RLS handles it)
- [ ] Consistent API route authentication

### Performance
- [ ] Server components where possible
- [ ] Proper data caching (React Query/SWR)
- [ ] Reduced client-side data fetching

---

## 🎯 IMMEDIATE NEXT STEPS (This Week)

1. **Audit RLS Policies** - Verify all tables have proper RLS that auto-scopes to club
2. **Create Auth Context** - Build unified auth provider to replace duplicate logic
3. **Choose Data Fetching Strategy** - Evaluate React Query vs SWR vs custom hooks
4. **Start Phase 1** - Begin migration of 2-3 pages to new patterns

---

## 📝 NOTES

- This is a comprehensive refactor - break into small PRs
- Test thoroughly after each phase
- Keep existing functionality working during migration
- Consider feature freeze during major refactors
- Document new patterns as they're established

---

## Questions to Answer Before Starting

1. **RLS vs Manual Filtering**: Can we trust RLS policies to always scope correctly? If yes, remove all manual filtering.
2. **Route Structure**: Which is canonical - `/admin` or `/clubs/[slug]/admin`? Make decision and stick to it.
3. **Data Fetching**: React Query, SWR, or custom hooks? Decision needed before Phase 1.
4. **Server Components**: How much can we convert to server components? Audit feasibility.
