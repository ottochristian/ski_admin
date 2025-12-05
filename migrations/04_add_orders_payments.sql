-- Migration 04: Add Orders & Payments Tables
-- Run this AFTER migrations 01, 02, 03
-- This separates payment logic from registrations

-- First, we need to check what payment fields exist in registrations
-- Run this query to see the structure:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'registrations';

-- Step 1: Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'refunded', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create payments table
CREATE TABLE IF NOT EXISTS payments (
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

-- Step 4: Migrate existing payment data from registrations
-- Based on your structure: amount_paid (numeric), payment_status (text)

-- Create orders for existing registrations with payments
-- Group by household + date to create logical orders
INSERT INTO orders (household_id, club_id, season_id, total_amount, status, created_at)
SELECT 
  a.household_id,
  r.club_id,
  r.season_id,
  COALESCE(SUM(r.amount_paid), 0) as total,
  CASE 
    WHEN COUNT(*) FILTER (WHERE r.payment_status = 'paid' OR r.payment_status = 'completed') = COUNT(*) THEN 'paid'
    WHEN COUNT(*) FILTER (WHERE r.payment_status = 'paid' OR r.payment_status = 'completed') > 0 THEN 'partially_paid'
    WHEN COUNT(*) FILTER (WHERE r.payment_status = 'pending') > 0 THEN 'unpaid'
    ELSE 'unpaid'
  END as order_status,
  MIN(COALESCE(r.registration_date, r.created_at)) as order_date
FROM registrations r
JOIN athletes a ON r.athlete_id = a.id
WHERE (r.amount_paid > 0 OR r.payment_status IS NOT NULL)
  AND a.household_id IS NOT NULL
GROUP BY a.household_id, r.club_id, r.season_id, DATE(COALESCE(r.registration_date, r.created_at))
ON CONFLICT DO NOTHING;

-- Create order_items for each registration
INSERT INTO order_items (order_id, registration_id, description, amount)
SELECT 
  o.id,
  r.id,
  COALESCE(
    CONCAT('Registration: ', p.name, ' - ', sp.name, ' (', a.first_name, ' ', a.last_name, ')'),
    CONCAT('Registration: ', a.first_name, ' ', a.last_name),
    'Registration'
  ) as description,
  COALESCE(r.amount_paid, 0) as amount
FROM registrations r
JOIN athletes a ON r.athlete_id = a.id
JOIN orders o ON o.household_id = a.household_id
  AND o.club_id = r.club_id
  AND o.season_id = r.season_id
  AND DATE(o.created_at) = DATE(COALESCE(r.registration_date, r.created_at))
LEFT JOIN sub_programs sp ON r.sub_program_id = sp.id
LEFT JOIN programs p ON sp.program_id = p.id
WHERE (r.amount_paid > 0 OR r.payment_status IS NOT NULL)
  AND a.household_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create payment records
-- Only create payments for orders that have actually been paid
INSERT INTO payments (order_id, amount, method, status, processed_at, created_at)
SELECT 
  o.id,
  o.total_amount,
  'stripe' as method,  -- Default to stripe, adjust if you track method elsewhere
  CASE 
    WHEN o.status = 'paid' THEN 'succeeded'
    WHEN o.status = 'partially_paid' THEN 'succeeded'  -- Partial payment succeeded
    ELSE 'pending'
  END as payment_status,
  o.updated_at as processed_at,
  o.created_at
FROM orders o
WHERE o.total_amount > 0 
  AND o.status IN ('paid', 'partially_paid')
ON CONFLICT DO NOTHING;

-- Step 5: Add indexes
CREATE INDEX IF NOT EXISTS idx_orders_household_id ON orders(household_id);
CREATE INDEX IF NOT EXISTS idx_orders_club_id ON orders(club_id);
CREATE INDEX IF NOT EXISTS idx_orders_season_id ON orders(season_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_registration_id ON order_items(registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Verify migration
SELECT 
  'Orders & Payments migration complete' as status,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM payments) as payments_count,
  (SELECT SUM(total_amount) FROM orders WHERE status = 'paid') as total_paid;

-- Note: After verifying, you can optionally:
-- 1. Remove payment columns from registrations (keep for now as backup)
-- 2. Update code to use orders/payments instead of registrations.amount_paid

