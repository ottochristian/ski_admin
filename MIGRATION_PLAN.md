# Database Migration Plan

## Based on Current Code Analysis

From analyzing your codebase, I can see:

### Current Structure (Inferred)
- `registrations` has: `payment_status`, `amount_paid` (payments embedded)
- `families` table exists (needs migration to `households`)
- `programs` is top-level (no `sports` layer yet)
- No `club_id` or `season_id` in any tables (everything is global)

---

## Phase 1: Foundation - Clubs & Seasons

### Step 1: Create Clubs Table

```sql
-- Create clubs table
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  address TEXT,
  contact_email TEXT,
  timezone TEXT DEFAULT 'America/Denver',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default club for existing data
INSERT INTO clubs (name, slug, primary_color) 
VALUES ('Default Club', 'default', '#3B82F6')
RETURNING id;
```

### Step 2: Add club_id to Existing Tables

```sql
-- Get the default club ID (replace with actual ID from step 1)
-- Or use: SELECT id FROM clubs WHERE slug = 'default';

-- Add club_id columns (nullable first)
ALTER TABLE profiles ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE families ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE athletes ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE programs ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE sub_programs ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE groups ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE registrations ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE coaches ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE coach_assignments ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE races ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE race_registrations ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE messages ADD COLUMN club_id UUID REFERENCES clubs(id);

-- Backfill with default club
DO $$
DECLARE
  default_club_id UUID := (SELECT id FROM clubs WHERE slug = 'default');
BEGIN
  UPDATE profiles SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE families SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE athletes SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE programs SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE sub_programs SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE groups SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE registrations SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE coaches SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE coach_assignments SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE races SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE race_registrations SET club_id = default_club_id WHERE club_id IS NULL;
  UPDATE messages SET club_id = default_club_id WHERE club_id IS NULL;
END $$;

-- Make club_id NOT NULL (after backfilling)
ALTER TABLE profiles ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE families ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE athletes ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE programs ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE sub_programs ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE groups ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE registrations ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE coaches ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE coach_assignments ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE races ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE race_registrations ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN club_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX idx_profiles_club_id ON profiles(club_id);
CREATE INDEX idx_families_club_id ON families(club_id);
CREATE INDEX idx_athletes_club_id ON athletes(club_id);
CREATE INDEX idx_programs_club_id ON programs(club_id);
CREATE INDEX idx_sub_programs_club_id ON sub_programs(club_id);
CREATE INDEX idx_registrations_club_id ON registrations(club_id);
```

### Step 3: Create Seasons Table

```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, name)
);

-- Create default season for existing data
INSERT INTO seasons (club_id, name, start_date, end_date, is_current, status)
SELECT 
  id,
  '2024-2025',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  true,
  'active'
FROM clubs WHERE slug = 'default';

-- Add season_id to relevant tables
ALTER TABLE programs ADD COLUMN season_id UUID REFERENCES seasons(id);
ALTER TABLE registrations ADD COLUMN season_id UUID REFERENCES seasons(id);
ALTER TABLE races ADD COLUMN season_id UUID REFERENCES seasons(id);
ALTER TABLE messages ADD COLUMN season_id UUID REFERENCES seasons(id);

-- Backfill season_id
DO $$
DECLARE
  default_season_id UUID := (SELECT id FROM seasons WHERE is_current = true LIMIT 1);
BEGIN
  UPDATE programs SET season_id = default_season_id WHERE season_id IS NULL;
  UPDATE registrations SET season_id = default_season_id WHERE season_id IS NULL;
  UPDATE races SET season_id = default_season_id WHERE season_id IS NULL;
  UPDATE messages SET season_id = default_season_id WHERE season_id IS NULL;
END $$;

-- Make season_id NOT NULL (for programs, registrations)
ALTER TABLE programs ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE registrations ALTER COLUMN season_id SET NOT NULL;

-- Add indexes
CREATE INDEX idx_programs_season_id ON programs(season_id);
CREATE INDEX idx_registrations_season_id ON registrations(season_id);
CREATE INDEX idx_seasons_club_id ON seasons(club_id);
```

---

## Phase 2: Households & Guardians

### Step 4: Create Households Table (Migrate from Families)

**First, check your current `families` table structure, then:**

```sql
-- Create households table
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  primary_email TEXT,
  phone TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create household_guardians join table
CREATE TABLE household_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Migration script (adjust based on your families table structure)
-- This assumes families has: id, profile_id, family_name, etc.
INSERT INTO households (id, club_id, primary_email, phone, address)
SELECT 
  f.id,
  f.club_id,
  p.email,
  f.phone, -- if exists
  f.address -- if exists
FROM families f
LEFT JOIN profiles p ON f.profile_id = p.id;

-- Link guardians
INSERT INTO household_guardians (household_id, user_id, is_primary)
SELECT 
  f.id,
  f.profile_id,
  true
FROM families f
WHERE f.profile_id IS NOT NULL;

-- Update athletes to reference households
ALTER TABLE athletes ADD COLUMN household_id UUID REFERENCES households(id);
UPDATE athletes a
SET household_id = f.id
FROM families f
WHERE a.family_id = f.id; -- adjust column name if different

-- After verifying migration, you can drop families table
-- (or keep it as backup for a while)
```

---

## Phase 3: Orders & Payments

### Step 5: Create Orders & Payments Tables

```sql
-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'refunded', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT DEFAULT 'stripe' CHECK (method IN ('stripe', 'cash', 'check', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing payment data from registrations
-- This creates orders for existing paid registrations
INSERT INTO orders (household_id, club_id, season_id, total_amount, status, created_at)
SELECT DISTINCT
  a.household_id,
  r.club_id,
  r.season_id,
  r.amount_paid,
  CASE 
    WHEN r.payment_status = 'paid' THEN 'paid'
    WHEN r.payment_status = 'pending' THEN 'unpaid'
    ELSE 'unpaid'
  END,
  r.created_at
FROM registrations r
JOIN athletes a ON r.athlete_id = a.id
WHERE r.amount_paid > 0;

-- Create order_items for each registration
INSERT INTO order_items (order_id, registration_id, description, amount)
SELECT 
  o.id,
  r.id,
  CONCAT('Registration: ', p.name, ' - ', sp.name),
  r.amount_paid
FROM registrations r
JOIN orders o ON o.household_id = (SELECT household_id FROM athletes WHERE id = r.athlete_id)
  AND o.club_id = r.club_id
  AND o.created_at::date = r.created_at::date
JOIN sub_programs sp ON r.sub_program_id = sp.id
JOIN programs p ON sp.program_id = p.id
WHERE r.amount_paid > 0;

-- Create payment records
INSERT INTO payments (order_id, amount, method, status, processed_at, created_at)
SELECT 
  o.id,
  o.total_amount,
  'stripe', -- or 'cash'/'check' if you track that
  CASE WHEN o.status = 'paid' THEN 'succeeded' ELSE 'pending' END,
  o.updated_at,
  o.created_at
FROM orders o
WHERE o.total_amount > 0;

-- Add indexes
CREATE INDEX idx_orders_household_id ON orders(household_id);
CREATE INDEX idx_orders_club_id ON orders(club_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_registration_id ON order_items(registration_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
```

---

## Phase 4: Sports Layer (Optional but Recommended)

### Step 6: Add Sports Table

```sql
CREATE TABLE sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Alpine", "Nordic", "Freeride"
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, season_id, name)
);

-- Add sport_id to programs
ALTER TABLE programs ADD COLUMN sport_id UUID REFERENCES sports(id);

-- Create default sports for existing programs
INSERT INTO sports (club_id, season_id, name, status)
SELECT DISTINCT
  club_id,
  season_id,
  'General', -- or extract from program name
  'active'
FROM programs
WHERE sport_id IS NULL;

-- Link programs to sports
UPDATE programs p
SET sport_id = s.id
FROM sports s
WHERE p.club_id = s.club_id 
  AND p.season_id = s.season_id
  AND s.name = 'General'
  AND p.sport_id IS NULL;

-- Make sport_id NOT NULL
ALTER TABLE programs ALTER COLUMN sport_id SET NOT NULL;

CREATE INDEX idx_sports_club_season ON sports(club_id, season_id);
CREATE INDEX idx_programs_sport_id ON programs(sport_id);
```

---

## Migration Checklist

### Before Running Migrations
- [ ] Backup your database
- [ ] Run `get_schema.sql` to document current state
- [ ] Test migrations on a copy/staging database first

### Phase 1: Clubs & Seasons
- [ ] Create `clubs` table
- [ ] Add `club_id` to all tables
- [ ] Backfill `club_id` with default club
- [ ] Create `seasons` table
- [ ] Add `season_id` to programs, registrations
- [ ] Update code to filter by club_id/season_id

### Phase 2: Households
- [ ] Create `households` table
- [ ] Create `household_guardians` table
- [ ] Migrate data from `families` → `households`
- [ ] Update `athletes` to use `household_id`
- [ ] Update code to use new structure

### Phase 3: Orders & Payments
- [ ] Create `orders`, `order_items`, `payments` tables
- [ ] Migrate payment data from `registrations`
- [ ] Update code to use new payment flow
- [ ] (Later) Remove payment columns from `registrations`

### Phase 4: Sports (Optional)
- [ ] Create `sports` table
- [ ] Add `sport_id` to programs
- [ ] Migrate existing programs

---

## Code Updates Needed

After each phase, update:

1. **Supabase queries** - Add `.eq('club_id', clubId)` filters
2. **TypeScript types** - Add `club_id`, `season_id` to interfaces
3. **API routes** - Extract club from URL/context
4. **Middleware** - Club-aware routing
5. **Components** - Pass club context

---

## Next Steps

1. **Run `get_schema.sql`** to get your exact table structures
2. **Share the results** so I can customize the migration scripts
3. **Choose a phase** to start with (I recommend Phase 1: Clubs)
4. **Test on staging** before production

