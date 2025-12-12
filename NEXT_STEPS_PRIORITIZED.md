# Next Steps - Prioritized Action Plan

## 🎯 Phase 1: Critical Pre-Production (Do First - This Week)

### 1. Run Database Migration ⚠️ CRITICAL
**Time:** 5 minutes  
**Risk:** Low  
**Impact:** High - Enables webhook idempotency

```bash
# Run in Supabase SQL Editor
migrations/28_add_webhook_events_table.sql
```

**Why:** Without this, Stripe webhooks can process duplicate payments. This is a critical bug for production.

---

### 2. Add Environment Variable Validation ⚠️ CRITICAL
**Time:** 30 minutes  
**Risk:** Low  
**Impact:** High - Prevents runtime failures

Create `lib/env.ts`:
```typescript
// lib/env.ts
export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ]

  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

// Call in next.config.ts or a startup file
```

**Why:** Fails fast at startup instead of mysterious runtime errors.

---

### 3. Update Critical API Routes to Use New Auth Helpers
**Time:** 1-2 hours  
**Risk:** Medium  
**Impact:** High - Security improvement

**Files to update:**
- [ ] `app/api/system-admin/invite-admin/route.ts` - Already uses manual auth, update to use `requireSystemAdmin()`
- [ ] Check for other API routes that need authentication

**Pattern:**
```typescript
// OLD
const authHeader = request.headers.get('authorization')
// ... manual auth checks ...

// NEW
import { requireSystemAdmin } from '@/lib/api-auth'
const authResult = await requireSystemAdmin(request)
if (authResult instanceof NextResponse) {
  return authResult
}
const { user, supabase, profile } = authResult
```

**Why:** Centralized, tested authentication logic reduces bugs.

---

### 4. Test Health Check Endpoint ✅
**Time:** 5 minutes  
**Risk:** None  
**Impact:** Medium - Monitoring capability

```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "timestamp": "...",
  "status": "healthy",
  "checks": {
    "api": "healthy",
    "database": "healthy"
  }
}
```

**Why:** Needed for load balancers and monitoring tools.

---

## 📈 Phase 2: Performance & Scalability (Next Week)

### 5. Add Pagination to Most-Critical List Pages
**Time:** 2-3 hours  
**Risk:** Low  
**Impact:** High - Performance at scale

**Priority order:**
1. `app/admin/registrations/page.tsx` - Likely to have most records
2. `app/admin/athletes/page.tsx` - 500 kids per club = 25,000 total
3. `app/admin/programs/page.tsx` - Less critical but still important
4. `app/clubs/[clubSlug]/parent/programs/page.tsx` - Parent-facing

**Use:** Follow `PAGINATION_EXAMPLE.md`

**Why:** Loading all registrations will timeout/fail with 25,000 users.

---

### 6. Migrate High-Traffic Components to New Supabase Client
**Time:** 2-3 hours  
**Risk:** Low-Medium  
**Impact:** Medium - Better session management

**Priority files (by usage):**
1. `app/login/page.tsx` - Every user hits this
2. `app/signup/page.tsx` - Critical user flow
3. `app/page.tsx` - Landing page redirect logic
4. `lib/club-context.tsx` - Used everywhere
5. `components/admin-sidebar.tsx` - Used on every admin page

**Pattern:**
```typescript
// OLD
import { supabase } from '@/lib/supabaseClient'

// NEW (Client Components)
import { createBrowserSupabaseClient } from '@/lib/supabase-client'
const supabase = createBrowserSupabaseClient()
```

**Why:** Better SSR support, automatic session refresh, fewer auth issues.

**Note:** You can keep the old `supabaseClient.ts` as a fallback and migrate incrementally. The new client is backward compatible.

---

### 7. Add Database Indexes for Performance
**Time:** 30 minutes  
**Risk:** Low (read-only)  
**Impact:** High - Query performance

Run in Supabase SQL Editor:
```sql
-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_registrations_club_season_status 
  ON registrations(club_id, season_id, status);

CREATE INDEX IF NOT EXISTS idx_registrations_club_season_created 
  ON registrations(club_id, season_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_athletes_club_household 
  ON athletes(club_id, household_id);

CREATE INDEX IF NOT EXISTS idx_orders_household_status_created 
  ON orders(household_id, status, created_at DESC);

-- Index foreign keys that are frequently queried
CREATE INDEX IF NOT EXISTS idx_registrations_athlete_id 
  ON registrations(athlete_id)
  WHERE athlete_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_sub_program_id 
  ON registrations(sub_program_id)
  WHERE sub_program_id IS NOT NULL;
```

**Why:** Without indexes, queries will be slow with large datasets.

---

### 8. Add Rate Limiting to API Routes
**Time:** 1-2 hours  
**Risk:** Low  
**Impact:** Medium - Prevents abuse

**Option A: Simple in-memory (Quick)**
```typescript
// lib/rate-limit.ts
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}
```

**Option B: Upstash Redis (Recommended for production)**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Apply to:**
- `/api/checkout` - 10 requests per minute per user
- `/api/login` - 5 attempts per minute per IP
- `/api/signup` - 3 attempts per hour per IP

**Why:** Prevents brute force attacks and DDoS.

---

## 🔒 Phase 3: Security Hardening (Week 3)

### 9. Complete Supabase Client Migration
**Time:** 4-6 hours  
**Risk:** Low (can be done incrementally)  
**Impact:** Medium - Better security & reliability

**Strategy:** Migrate file by file, test each one.

**All 42 files found:**
- High priority (done in Phase 2): login, signup, club-context
- Medium priority: Admin pages
- Low priority: System admin pages (lower traffic)

**Use search & replace:**
```bash
# Find files
grep -r "from '@/lib/supabaseClient'" app/ components/ lib/

# Update one at a time, test, commit
```

**Why:** Complete migration ensures consistent session handling.

---

### 10. Add Input Validation & Sanitization
**Time:** 2-3 hours  
**Risk:** Low  
**Impact:** Medium - Security improvement

Create `lib/validation.ts`:
```typescript
import { z } from 'zod'

export const emailSchema = z.string().email()
export const uuidSchema = z.string().uuid()
export const clubSlugSchema = z.string().regex(/^[a-z0-9-]+$/)

// Use in API routes
export async function POST(request: NextRequest) {
  const body = await request.json()
  const validated = emailSchema.parse(body.email)
  // ...
}
```

**Why:** Prevents injection attacks and malformed data.

---

### 11. Set Up Error Monitoring (Sentry)
**Time:** 1-2 hours  
**Risk:** None  
**Impact:** High - Visibility into production issues

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Why:** You can't fix what you don't know about.

---

## 🚀 Phase 4: Production Readiness (Week 4)

### 12. Load Testing
**Time:** 4-6 hours  
**Risk:** None (testing only)  
**Impact:** High - Validate scalability

**Test scenarios:**
1. 50 concurrent admin users
2. 500 concurrent parent users (one club)
3. Registration checkout flow under load
4. Database query performance with 25,000 athletes

**Tools:**
- k6 (recommended)
- Artillery
- Locust

**Why:** Identifies bottlenecks before production issues.

---

### 13. Optimize Club Context (Caching)
**Time:** 2-3 hours  
**Risk:** Medium  
**Impact:** Medium - Performance improvement

**Current issue:** Club context queries DB on every route change.

**Solution:**
```typescript
// Cache club data in sessionStorage or cookie
// Refresh only when club slug changes
```

**Why:** Reduces unnecessary database queries.

---

### 14. Configure Database Connection Pooling
**Time:** 30 minutes  
**Risk:** Low  
**Impact:** High - Scalability

**Update environment variable:**
```env
# Use pooler URL instead of direct connection
DATABASE_URL=postgres://postgres.[project-ref].pooler.supabase.com:6543/postgres
```

**Why:** Handles connection spikes better than direct connections.

---

### 15. Create Deployment Checklist
**Time:** 1 hour  
**Risk:** None  
**Impact:** Medium - Prevents deployment mistakes

Document:
- Environment variables required
- Database migrations to run
- Post-deployment verification steps
- Rollback procedure

---

## 📊 Quick Wins (Can Do Anytime)

### ✅ Already Done
- [x] Health check endpoint
- [x] Security headers
- [x] Improved middleware
- [x] Webhook idempotency code
- [x] Logging infrastructure
- [x] API auth helpers

### 🔧 Low-Hanging Fruit
- [ ] Add `.limit(100)` to any query without pagination (quick safety measure)
- [ ] Add error boundaries to layout files
- [ ] Add loading skeletons (better UX)
- [ ] Document API endpoints
- [ ] Add request logging to API routes

---

## 🎯 Recommended Order

**This Week:**
1. Run webhook migration (#1) - 5 min
2. Add env validation (#2) - 30 min
3. Test health endpoint (#4) - 5 min
4. Update 1-2 API routes (#3) - 1 hour

**Next Week:**
5. Add pagination to registrations page (#5) - 1 hour
6. Migrate login/signup pages (#6) - 1 hour
7. Add database indexes (#7) - 30 min
8. Add basic rate limiting (#8) - 1 hour

**Week 3:**
9. Complete Supabase migration (#9) - Spread over week
10. Add input validation (#10) - 2 hours
11. Set up Sentry (#11) - 1 hour

**Week 4:**
12. Load testing (#12) - 4-6 hours
13. Optimize club context (#13) - 2 hours
14. Configure connection pooling (#14) - 30 min

---

## 📝 Notes

### Migration Strategy
- **Incremental is fine:** You don't need to migrate everything at once
- **Test each change:** Update → Test → Commit
- **Keep old code:** Don't delete `supabaseClient.ts` until migration complete

### Risk Mitigation
- All changes are backward compatible
- Can rollback individual changes
- Test in development first
- Use feature flags if needed

### Time Estimates
- Conservative estimates for safety
- Actual time may be less
- Can parallelize some tasks

---

## 🆘 If You're Short on Time

**Absolute minimum for production:**
1. ✅ Run webhook migration (#1)
2. ✅ Add env validation (#2)
3. ✅ Add pagination to registrations (#5)
4. ✅ Add database indexes (#7)
5. ✅ Set up basic monitoring (#11)

**Everything else can wait**, but these are critical for stability at scale.

---

**Last Updated:** Based on current codebase analysis
**Status:** Ready to start Phase 1


