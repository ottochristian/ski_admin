-- Manual fix for a payment that succeeded in Stripe but webhook didn't process
-- ONLY use this if you're certain the payment succeeded in Stripe
-- Run this in Supabase SQL Editor

-- Replace these with your actual values from Stripe Dashboard:
-- Payment Intent ID: pi_3ScDbNC5HfhugA4811tVAsq2 (from Stripe Dashboard)
-- Order ID: (find this from your orders table - the most recent unpaid order)
-- Amount: $1.00 = 100 cents

-- 1. Find the order ID (uncomment and run to find it)
/*
SELECT 
  id as order_id,
  total_amount,
  status,
  created_at
FROM orders
WHERE status = 'unpaid'
ORDER BY created_at DESC
LIMIT 5;
*/

-- 2. Once you have the order_id, update this and run:
/*
\set order_id 'YOUR_ORDER_ID_HERE'
\set payment_intent_id 'pi_3ScDbNC5HfhugA4811tVAsq2'
\set checkout_session_id 'cs_test_YOUR_SESSION_ID'  -- Optional, if you have it

-- Update order status
UPDATE orders
SET status = 'paid',
    updated_at = NOW()
WHERE id = :'order_id';

-- Create payment record
INSERT INTO payments (
  order_id,
  amount,
  method,
  status,
  stripe_payment_intent_id,
  stripe_checkout_session_id,
  processed_at
)
VALUES (
  :'order_id',
  (SELECT total_amount FROM orders WHERE id = :'order_id'),
  'stripe',
  'succeeded',
  :'payment_intent_id',
  :'checkout_session_id',
  NOW()
)
ON CONFLICT DO NOTHING;

-- Update registrations
UPDATE registrations r
SET 
  status = 'confirmed',
  payment_status = 'paid',
  amount_paid = COALESCE((
    SELECT oi.amount 
    FROM order_items oi 
    WHERE oi.registration_id = r.id 
      AND oi.order_id = :'order_id'
    LIMIT 1
  ), 0)
WHERE r.id IN (
  SELECT oi.registration_id
  FROM order_items oi
  WHERE oi.order_id = :'order_id'
  AND oi.registration_id IS NOT NULL
);

-- Verify the update
SELECT 
  'Verification' as check_step,
  o.id as order_id,
  o.status as order_status,
  p.status as payment_status,
  COUNT(r.id) as registrations_updated
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN registrations r ON r.id = oi.registration_id
WHERE o.id = :'order_id'
GROUP BY o.id, o.status, p.status;
*/

