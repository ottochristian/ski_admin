-- Diagnostic query to check order payment status
-- Replace '6bb48625' with your actual order ID

-- 1. Check the order status
SELECT 
  id as order_id,
  total_amount,
  status as order_status,
  created_at,
  updated_at
FROM orders
WHERE id = '6bb48625';

-- 2. Check if payment record exists
SELECT 
  id as payment_id,
  order_id,
  amount,
  status as payment_status,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  processed_at,
  created_at
FROM payments
WHERE order_id = '6bb48625';

-- 3. Check webhook events for this order
-- First, find the Stripe checkout session ID from the order metadata
-- (You may need to check Stripe Dashboard for this)
SELECT 
  we.stripe_event_id,
  we.event_type,
  we.processed,
  we.processed_at,
  we.error_message,
  we.created_at,
  -- Extract order_id from metadata if available
  (we.metadata->>'metadata'->>'order_id')::text as extracted_order_id
FROM webhook_events we
WHERE we.event_type = 'checkout.session.completed'
  AND we.created_at > NOW() - INTERVAL '24 hours'
ORDER BY we.created_at DESC
LIMIT 10;

-- 4. Check registrations linked to this order
SELECT 
  r.id as registration_id,
  r.status as registration_status,
  r.payment_status,
  r.amount_paid,
  r.athlete_id,
  r.sub_program_id,
  oi.order_id,
  oi.amount as order_item_amount
FROM registrations r
JOIN order_items oi ON oi.registration_id = r.id
WHERE oi.order_id = '6bb48625';

-- 5. Get Stripe checkout session ID from order (if stored in metadata)
-- This might be in a separate metadata table or column
SELECT 
  id,
  metadata,
  -- Some orders might store stripe_session_id in a separate column
  created_at
FROM orders
WHERE id = '6bb48625';

-- 6. Check if there are multiple webhook events that should have processed this
-- Look for checkout.session.completed events in the last 24 hours
SELECT 
  we.stripe_event_id,
  we.event_type,
  we.processed,
  we.error_message,
  we.created_at,
  we.processed_at,
  -- Try to extract order_id from metadata JSON
  CASE 
    WHEN we.metadata::text LIKE '%6bb48625%' THEN 'MATCH'
    ELSE 'NO MATCH'
  END as order_match
FROM webhook_events we
WHERE we.event_type = 'checkout.session.completed'
  AND we.created_at > NOW() - INTERVAL '7 days'
ORDER BY we.created_at DESC;
