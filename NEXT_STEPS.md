# Next Steps Plan - Ski Admin System

## Current State Assessment

### ✅ What You Have
- Next.js app with TypeScript + Tailwind
- Supabase integration (auth + database)
- Basic admin portal with sidebar navigation
- Admin pages: Programs, Sub-programs, Groups, Athletes, Coaches, Registrations, Reports
- Basic dashboard with stats
- Auth system (profiles table with roles)
- Some database tables: `profiles`, `athletes`, `programs`, `sub_programs`, `groups`, `registrations`, `families`

### ❌ Critical Gaps (vs. Spec)
1. **No multi-club architecture** - Everything is single-club/global
2. **No seasons** - No season-scoped data
3. **Incomplete household model** - Have `families` but not full `households` + `household_guardians` structure
4. **No orders/payments separation** - Payments seem embedded in registrations
5. **No parent portal** - Only admin/coach portals exist
6. **No Stripe integration**
7. **No Resend email integration**
8. **No waivers system**
9. **No club-aware routing** (`/clubs/[clubSlug]/...`)

---

## Immediate Next Step: **Database Schema Audit & Foundation**

### Why This First?
Everything else depends on having the right data model. You can't build parent portals, multi-club features, or proper payment flows without the foundation.

### Action Plan

#### Phase 1: Schema Audit (1-2 days)
**Goal:** Understand exactly what you have vs. what you need

1. **Document Current Schema**
   - Export current Supabase schema (SQL dump or screenshot all tables)
   - List all tables, columns, relationships, constraints
   - Compare against spec requirements

2. **Create Gap Analysis Document**
   - Tables you have that match spec ✅
   - Tables you have that need changes ⚠️
   - Tables missing from spec ❌
   - Priority ranking (what blocks other features)

#### Phase 2: Foundation Migration (3-5 days)
**Goal:** Add the foundational tables that everything else depends on

**Priority Order:**

1. **Clubs Table** (HIGHEST PRIORITY)
   - Why: Multi-club is core to the entire system
   - Tables needed: `clubs`
   - Migration: Add club_id to existing tables (profiles, programs, etc.)
   - Impact: Enables club-aware routing and multi-tenancy

2. **Seasons Table** (HIGH PRIORITY)
   - Why: Season-scoped data is fundamental
   - Tables needed: `seasons`
   - Migration: Add season_id to programs, registrations, etc.
   - Impact: Enables proper season management

3. **Households & Guardians** (HIGH PRIORITY)
   - Why: Parent portal depends on this
   - Tables needed: `households`, `household_guardians`
   - Migration: Migrate `families` → `households`, link guardians properly
   - Impact: Enables parent portal, proper family management

4. **Orders & Payments Separation** (MEDIUM PRIORITY)
   - Why: Clean payment flow requires this
   - Tables needed: `orders`, `order_items`, `payments`
   - Migration: Extract payment data from registrations
   - Impact: Enables Stripe integration, proper invoicing

---

## Recommended Immediate Action: **Start with Clubs**

### Why Clubs First?
- It's the foundation for everything
- Relatively isolated change (add table, add foreign keys)
- Unblocks multi-club routing
- Can be done incrementally

### Step-by-Step: Add Clubs Foundation

#### Step 1: Create Clubs Table (30 min)
```sql
-- Run in Supabase SQL Editor
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- e.g., "gtssf", "jackson-hole"
  logo_url TEXT,
  primary_color TEXT, -- hex color
  address TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default club for existing data
INSERT INTO clubs (name, slug, primary_color) 
VALUES ('Default Club', 'default', '#3B82F6');
```

#### Step 2: Add club_id to Existing Tables (1-2 hours)
```sql
-- Add club_id columns
ALTER TABLE programs ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE athletes ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE profiles ADD COLUMN club_id UUID REFERENCES clubs(id);

-- Set all existing rows to default club
UPDATE programs SET club_id = (SELECT id FROM clubs WHERE slug = 'default');
UPDATE athletes SET club_id = (SELECT id FROM clubs WHERE slug = 'default');
UPDATE profiles SET club_id = (SELECT id FROM clubs WHERE slug = 'default');

-- Make club_id NOT NULL after backfilling
ALTER TABLE programs ALTER COLUMN club_id SET NOT NULL;
-- (repeat for other tables)
```

#### Step 3: Update Code to Use Clubs (2-3 hours)
- Update Supabase queries to filter by club_id
- Add club context/provider
- Update admin pages to be club-aware

#### Step 4: Add Club-Aware Routing (1-2 hours)
- Create `/clubs/[clubSlug]` route structure
- Update middleware to extract club from URL
- Redirect existing routes to club-aware versions

---

## Alternative: If You Want to Ship Parent Portal First

If you want to see user-facing progress faster, you could:

1. **Skip clubs for now** (assume single club)
2. **Focus on Households + Parent Portal**
3. **Build the registration flow** (programs → cart → checkout)
4. **Add Stripe integration**

This gets you a working parent experience faster, but you'll need to refactor for multi-club later.

---

## Recommended Path Forward

### Option A: Foundation First (Recommended)
**Timeline: 1-2 weeks**
1. Week 1: Schema audit + Clubs + Seasons
2. Week 2: Households migration + Orders/Payments

**Pros:** Solid foundation, less refactoring later
**Cons:** No visible user features for 1-2 weeks

### Option B: Feature First (Faster Demo)
**Timeline: 1 week**
1. Week 1: Households + Parent Portal + Basic Registration Flow

**Pros:** Working parent experience quickly
**Cons:** Will need to refactor for multi-club later

---

## My Recommendation: **Start with Schema Audit**

Before making any changes, spend 2-4 hours:

1. **Document your current schema** (export from Supabase)
2. **Create a migration plan document** showing:
   - Current state
   - Target state (from spec)
   - Migration steps
   - Risk assessment

Then decide: Foundation First or Feature First based on your priorities.

---

## Quick Wins You Can Do Today (While Planning)

These don't require schema changes:

1. **Improve Admin Dashboard** (2-3 hours)
   - Add the charts/widgets from spec (revenue vs last season, capacity & waitlists)
   - Add "Recent Activity" feed
   - Add "Alerts" section

2. **Add Loading/Error States** (1-2 hours)
   - Consistent loading spinners
   - Better error messages
   - Empty states

3. **Polish UI Components** (2-3 hours)
   - Ensure all pages use consistent layout
   - Add breadcrumbs
   - Improve mobile responsiveness

---

## Questions to Answer Before Proceeding

1. **Do you need multi-club support immediately?**
   - If YES → Start with Clubs
   - If NO → Can defer, focus on single-club parent portal

2. **Do you have real users/clubs waiting?**
   - If YES → Prioritize working features over perfect architecture
   - If NO → Take time to build foundation right

3. **What's your timeline pressure?**
   - Tight deadline → Feature First
   - Flexible → Foundation First

---

## Next Immediate Action

**I recommend starting with:**

1. **Today:** Export current Supabase schema and create a schema comparison document
2. **This Week:** Add Clubs table + basic club-aware routing (if multi-club needed) OR start Households migration (if single-club for now)
3. **Next Week:** Based on decision above, either continue foundation OR build parent portal

Would you like me to:
- A) Help you audit your current schema?
- B) Create the Clubs migration SQL and code changes?
- C) Start building the parent portal (assuming single-club for now)?
- D) Something else?

