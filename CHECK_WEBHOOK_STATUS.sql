-- Check Webhook and Payment Status
-- Run this to diagnose why registration status isn't updating

-- 1. Check recent orders
SELECT 
  'Recent Orders' as check_type,
  o.id,
  o.created_at,
  o.total_amount,
  o.status as order_status,
  o.household_id,
  o.club_id
FROM orders o
ORDER BY o.created_at DESC
LIMIT 5;

-- 2. Check payments for recent orders
SELECT 
  'Recent Payments' as check_type,
  p.id,
  p.order_id,
  p.amount,
  p.method,
  p.status as payment_status,
  p.processed_at,
  p.stripe_checkout_session_id
FROM payments p
ORDER BY p.processed_at DESC NULLS LAST
LIMIT 5;

-- 3. Check registrations for recent orders
SELECT 
  'Recent Registrations' as check_type,
  r.id,
  r.status as registration_status,
  r.payment_status,
  r.amount_paid,
  a.first_name || ' ' || a.last_name as athlete_name,
  sp.name as sub_program_name,
  oi.order_id
FROM registrations r
JOIN athletes a ON r.athlete_id = a.id
JOIN sub_programs sp ON r.sub_program_id = sp.id
LEFT JOIN order_items oi ON oi.registration_id = r.id
WHERE r.created_at > NOW() - INTERVAL '24 hours'
ORDER BY r.created_at DESC
LIMIT 10;

-- 4. Check webhook events
SELECT 
  'Webhook Events' as check_type,
  we.id,
  we.stripe_event_id,
  we.event_type,
  we.processed,
  we.processed_at,
  we.error_message,
  we.created_at
FROM webhook_events we
ORDER BY we.created_at DESC
LIMIT 10;

-- 5. Check for unpaid registrations with orders
SELECT 
  'Unpaid with Orders' as check_type,
  r.id as registration_id,
  r.status as reg_status,
  r.payment_status,
  o.id as order_id,
  o.status as order_status,
  o.total_amount,
  a.first_name || ' ' || a.last_name as athlete_name
FROM registrations r
JOIN order_items oi ON oi.registration_id = r.id
JOIN orders o ON oi.order_id = o.id
JOIN athletes a ON r.athlete_id = a.id
WHERE r.payment_status = 'unpaid' 
  AND r.created_at > NOW() - INTERVAL '24 hours'
ORDER BY r.created_at DESC;
