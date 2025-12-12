-- Quick fix for the payment that succeeded in Stripe but webhook didn't process
-- This manually updates the most recent unpaid order to paid status
-- Run this in Supabase SQL Editor

-- Find the most recent unpaid order (from your query results, you have 3 orders)
-- We'll update the MOST RECENT one (created_at: 23:10)
WITH latest_order AS (
  SELECT id, total_amount
  FROM orders
  WHERE status = 'unpaid'
  ORDER BY created_at DESC
  LIMIT 1
)
-- Update order to paid
UPDATE orders
SET status = 'paid', updated_at = NOW()
WHERE id = (SELECT id FROM latest_order);

-- Create payment record for that order
WITH latest_order AS (
  SELECT id, total_amount
  FROM orders
  WHERE status = 'paid'
  ORDER BY updated_at DESC
  LIMIT 1
)
INSERT INTO payments (
  order_id,
  amount,
  method,
  status,
  stripe_payment_intent_id,
  processed_at
)
SELECT 
  id,
  total_amount,
  'stripe',
  'succeeded',
  'pi_3ScDbNC5HfhugA4811tVAsq2', -- From your Stripe Dashboard
  NOW()
FROM latest_order
WHERE NOT EXISTS (
  SELECT 1 FROM payments WHERE order_id = latest_order.id
);

-- Update registrations for that order
WITH latest_order AS (
  SELECT id
  FROM orders
  WHERE status = 'paid'
  ORDER BY updated_at DESC
  LIMIT 1
)
UPDATE registrations r
SET 
  status = 'confirmed',
  payment_status = 'paid',
  amount_paid = COALESCE((
    SELECT oi.amount 
    FROM order_items oi 
    WHERE oi.registration_id = r.id 
      AND oi.order_id = (SELECT id FROM latest_order)
    LIMIT 1
  ), 0)
WHERE r.id IN (
  SELECT oi.registration_id
  FROM order_items oi
  JOIN latest_order lo ON oi.order_id = lo.id
  WHERE oi.registration_id IS NOT NULL
);

-- Verify the fix
SELECT 
  'Fix Verification' as check_step,
  o.id as order_id,
  o.status as order_status,
  o.total_amount,
  p.id as payment_id,
  p.status as payment_status,
  COUNT(DISTINCT r.id) as registrations_count
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN registrations r ON r.id = oi.registration_id
WHERE o.status = 'paid'
GROUP BY o.id, o.status, o.total_amount, p.id, p.status
ORDER BY o.updated_at DESC
LIMIT 5;
