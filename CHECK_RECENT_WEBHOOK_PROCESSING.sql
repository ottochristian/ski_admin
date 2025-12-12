-- Check if the recent webhook was processed successfully
-- Run this after a payment to verify webhook processing

-- 1. Check recent webhook events
SELECT 
  stripe_event_id,
  event_type,
  processed,
  processed_at,
  error_message,
  created_at
FROM webhook_events
WHERE event_type = 'checkout.session.completed'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check recent orders and their status
SELECT 
  id as order_id,
  total_amount,
  status,
  created_at,
  updated_at
FROM orders
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check recent payments
SELECT 
  id as payment_id,
  order_id,
  amount,
  status,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  processed_at,
  created_at
FROM payments
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check recent registrations and their payment status
SELECT 
  id as registration_id,
  athlete_id,
  sub_program_id,
  status,
  payment_status,
  amount_paid,
  created_at,
  updated_at
FROM registrations
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verify order -> payment -> registration linkage for most recent order
WITH recent_order AS (
  SELECT id, total_amount, status
  FROM orders
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  'Order' as table_name,
  ro.id,
  ro.total_amount,
  ro.status,
  NULL as payment_status,
  NULL as amount_paid
FROM recent_order ro
UNION ALL
SELECT 
  'Payment' as table_name,
  p.order_id::text,
  p.amount,
  p.status,
  NULL as payment_status,
  NULL as amount_paid
FROM recent_order ro
LEFT JOIN payments p ON p.order_id = ro.id
UNION ALL
SELECT 
  'Registration' as table_name,
  r.id::text,
  NULL as total_amount,
  r.status,
  r.payment_status,
  r.amount_paid
FROM recent_order ro
JOIN order_items oi ON oi.order_id = ro.id
JOIN registrations r ON r.id = oi.registration_id
ORDER BY table_name;

