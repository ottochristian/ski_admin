-- Diagnostic and Fix script for order 6bb48625-73f5-4464-bbb7-8ffb4b4efff9
-- Note: 6bb48625 is the shortened display ID, full UUID is: 6bb48625-73f5-4464-bbb7-8ffb4b4efff9
-- Run the diagnostic queries first, then the fix if needed

-- ========================================
-- DIAGNOSTIC QUERIES
-- ========================================

-- 1. Check current order status
SELECT 
  '1. Order Status' as diagnostic_step,
  id as order_id,
  total_amount,
  status,
  created_at,
  updated_at
FROM orders
WHERE id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9';

-- 2. Check for payments linked to this order
SELECT 
  '2. Payment Records' as diagnostic_step,
  id as payment_id,
  order_id,
  amount,
  status as payment_status,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  processed_at,
  created_at
FROM payments
WHERE order_id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9';

-- 3. Check registrations for this order
SELECT 
  '3. Registrations' as diagnostic_step,
  r.id as registration_id,
  r.status as registration_status,
  r.payment_status,
  r.amount_paid,
  oi.amount as order_item_amount,
  a.first_name || ' ' || a.last_name as athlete_name
FROM registrations r
JOIN order_items oi ON oi.registration_id = r.id
LEFT JOIN athletes a ON a.id = r.athlete_id
WHERE oi.order_id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9';

-- 4. Check webhook events that might be related
-- Look for checkout.session.completed events around the order creation time
SELECT 
  '4. Webhook Events' as diagnostic_step,
  we.stripe_event_id,
  we.event_type,
  we.processed,
  we.error_message,
  we.created_at,
  we.processed_at,
  CASE 
    WHEN we.metadata::text LIKE '%6bb48625%' THEN '✓ Contains order ID'
    ELSE '✗ No order ID match'
  END as order_id_match
FROM webhook_events we
WHERE we.event_type = 'checkout.session.completed'
  AND we.created_at > (
    SELECT created_at - INTERVAL '1 hour' 
    FROM orders 
    WHERE id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
  )
  AND we.created_at < (
    SELECT created_at + INTERVAL '1 hour' 
    FROM orders 
    WHERE id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
  )
ORDER BY we.created_at DESC;

-- ========================================
-- FIX SCRIPT
-- Only run if payment actually succeeded in Stripe Dashboard!
-- ========================================

-- TO FIX: Replace 'YOUR_STRIPE_SESSION_ID' with the actual checkout session ID from Stripe Dashboard
-- You can find it in: Stripe Dashboard > Payments > Checkout Sessions

-- Step 5: Update order to paid
UPDATE orders
SET 
  status = 'paid',
  updated_at = NOW()
WHERE id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
  AND status != 'paid';

-- Step 6: Create payment record (if missing)
-- IMPORTANT: Replace 'YOUR_STRIPE_SESSION_ID' and 'YOUR_STRIPE_PAYMENT_INTENT_ID' with actual values from Stripe
INSERT INTO payments (
  order_id,
  amount,
  method,
  status,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  processed_at
)
SELECT 
  '6bb48625-73f5-4464-bbb7-8ffb4b4efff9',
  o.total_amount,
  'stripe',
  'succeeded',
  'YOUR_STRIPE_SESSION_ID', -- Replace with actual session ID (starts with cs_)
  'YOUR_STRIPE_PAYMENT_INTENT_ID', -- Replace with actual payment intent ID (starts with pi_)
  NOW()
FROM orders o
WHERE o.id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
  AND NOT EXISTS (
    SELECT 1 FROM payments WHERE order_id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
  );

-- Step 7: Update registrations to confirmed and paid
UPDATE registrations r
SET 
  status = 'confirmed',
  payment_status = 'paid',
  amount_paid = COALESCE(
    (SELECT oi.amount 
     FROM order_items oi 
     WHERE oi.registration_id = r.id 
       AND oi.order_id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
     LIMIT 1),
    r.amount_paid,
    0
  ),
  updated_at = NOW()
WHERE r.id IN (
  SELECT oi.registration_id 
  FROM order_items oi 
  WHERE oi.order_id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
    AND oi.registration_id IS NOT NULL
)
  AND (r.status != 'confirmed' OR r.payment_status != 'paid');

-- Step 8: Verify the fix
SELECT 
  '✓ Fix Verification - Order' as verification_step,
  id as order_id,
  status,
  total_amount,
  updated_at
FROM orders 
WHERE id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
UNION ALL
SELECT 
  '✓ Fix Verification - Payment' as verification_step,
  id::text,
  status,
  amount::numeric,
  processed_at
FROM payments 
WHERE order_id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9'
UNION ALL
SELECT 
  '✓ Fix Verification - Registrations' as verification_step,
  id::text,
  status || '/' || payment_status,
  amount_paid,
  updated_at
FROM registrations 
WHERE id IN (
  SELECT registration_id 
  FROM order_items 
  WHERE order_id = '6bb48625-73f5-4464-bbb7-8ffb4b4efff9' 
    AND registration_id IS NOT NULL
);

