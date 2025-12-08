-- Check if webhook events were received for your payment
-- Run this in Supabase SQL Editor

-- 1. Check all webhook events (most recent first)
SELECT 
  'Webhook Events' as check_type,
  id,
  stripe_event_id,
  event_type,
  processed,
  processed_at,
  error_message,
  created_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check payments table
SELECT 
  'Payments' as check_type,
  id,
  order_id,
  amount,
  status,
  method,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  processed_at,
  created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check orders and their status
SELECT 
  'Orders' as check_type,
  o.id as order_id,
  o.total_amount,
  o.status as order_status,
  o.created_at,
  p.id as payment_id,
  p.status as payment_status,
  p.stripe_payment_intent_id
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 10;

-- 4. Check registrations status
SELECT 
  'Registrations' as check_type,
  r.id,
  r.status,
  r.payment_status,
  r.amount_paid,
  r.created_at,
  o.id as order_id,
  o.status as order_status
FROM registrations r
LEFT JOIN order_items oi ON oi.registration_id = r.id
LEFT JOIN orders o ON o.id = oi.order_id
ORDER BY r.created_at DESC
LIMIT 10;