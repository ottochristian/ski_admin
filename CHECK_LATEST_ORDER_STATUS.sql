-- Check the most recent order and its payment status
-- Use this to verify the webhook processed correctly

-- 1. Get the most recent order
SELECT 
  'Latest Order' as check_type,
  id as order_id,
  SUBSTRING(id::text, 1, 8) as display_id,
  total_amount,
  status,
  created_at,
  updated_at,
  CASE 
    WHEN status = 'paid' THEN '✓ Paid'
    WHEN status = 'unpaid' THEN '✗ Unpaid'
    ELSE status
  END as status_check
FROM orders
ORDER BY created_at DESC
LIMIT 1;

-- 2. Check if payment record exists for the most recent order
WITH latest_order AS (
  SELECT id, total_amount, created_at
  FROM orders
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  'Payment Record' as check_type,
  p.id as payment_id,
  p.order_id,
  p.amount,
  p.status as payment_status,
  p.stripe_checkout_session_id,
  p.stripe_payment_intent_id,
  p.processed_at,
  CASE 
    WHEN p.id IS NOT NULL THEN '✓ Payment exists'
    ELSE '✗ No payment record'
  END as payment_check
FROM latest_order lo
LEFT JOIN payments p ON p.order_id = lo.id;

-- 3. Check registrations for the most recent order
WITH latest_order AS (
  SELECT id
  FROM orders
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  'Registrations' as check_type,
  r.id as registration_id,
  r.status as registration_status,
  r.payment_status,
  r.amount_paid,
  a.first_name || ' ' || a.last_name as athlete_name,
  sp.name as sub_program_name,
  CASE 
    WHEN r.status = 'confirmed' AND r.payment_status = 'paid' THEN '✓ Confirmed & Paid'
    WHEN r.status = 'pending' AND r.payment_status = 'unpaid' THEN '⚠ Still Pending'
    ELSE r.status || '/' || r.payment_status
  END as status_check
FROM latest_order lo
JOIN order_items oi ON oi.order_id = lo.id
JOIN registrations r ON r.id = oi.registration_id
LEFT JOIN athletes a ON a.id = r.athlete_id
LEFT JOIN sub_programs sp ON sp.id = r.sub_program_id;

-- 4. Check webhook event processing for the most recent checkout
SELECT 
  'Webhook Event' as check_type,
  we.stripe_event_id,
  we.event_type,
  we.processed,
  we.error_message,
  we.created_at,
  we.processed_at,
  CASE 
    WHEN we.processed = true AND we.error_message IS NULL THEN '✓ Processed successfully'
    WHEN we.processed = true AND we.error_message IS NOT NULL THEN '⚠ Processed with error: ' || we.error_message
    ELSE '✗ Not processed yet'
  END as webhook_check
FROM webhook_events we
WHERE we.event_type = 'checkout.session.completed'
  AND we.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY we.created_at DESC
LIMIT 1;

-- 5. Complete status summary for the most recent order
WITH latest_order AS (
  SELECT id, total_amount, status, created_at
  FROM orders
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  'Summary' as check_type,
  lo.id as order_id,
  SUBSTRING(lo.id::text, 1, 8) as display_id,
  lo.status as order_status,
  lo.total_amount,
  COUNT(DISTINCT p.id) as payment_count,
  COUNT(DISTINCT r.id) as registration_count,
  SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_registrations,
  SUM(CASE WHEN r.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_registrations,
  CASE 
    WHEN lo.status = 'paid' 
      AND COUNT(DISTINCT p.id) > 0 
      AND COUNT(DISTINCT r.id) = SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END)
    THEN '✓ Fully Processed'
    WHEN lo.status = 'paid' AND COUNT(DISTINCT p.id) = 0
    THEN '⚠ Order marked paid but no payment record'
    WHEN lo.status = 'unpaid' AND COUNT(DISTINCT p.id) > 0
    THEN '⚠ Payment exists but order still unpaid'
    ELSE '✗ Needs attention'
  END as overall_status
FROM latest_order lo
LEFT JOIN payments p ON p.order_id = lo.id
LEFT JOIN order_items oi ON oi.order_id = lo.id
LEFT JOIN registrations r ON r.id = oi.registration_id
GROUP BY lo.id, lo.status, lo.total_amount;


