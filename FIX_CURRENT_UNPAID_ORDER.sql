-- Fix the current stuck order (Order #25999db9, $500)
-- This order has a successful payment in Stripe but wasn't updated due to the useEffect bug

-- Step 1: Find the order and verify it exists
SELECT 
  'Current Order Status' as check_type,
  id,
  total_amount,
  status,
  created_at
FROM orders 
WHERE id = '25999db9'
  AND status = 'unpaid';

-- Step 2: Update order status to 'paid'
UPDATE orders
SET 
  status = 'paid',
  updated_at = NOW()
WHERE id = '25999db9';

-- Step 3: Create payment record
-- Using the Stripe payment intent from the screenshot: pi_3Sf6oXC5HfhugA482E4bTxOm
INSERT INTO payments (
  order_id,
  amount,
  method,
  status,
  stripe_payment_intent_id,
  processed_at
) VALUES (
  '25999db9',
  500.00,
  'stripe',
  'succeeded',
  'pi_3Sf6oXC5HfhugA482E4bTxOm',
  NOW()
)
ON CONFLICT DO NOTHING;

-- Step 4: Update all registrations for this order to confirmed/paid
UPDATE registrations
SET 
  status = 'confirmed',
  payment_status = 'paid',
  amount_paid = 500.00
WHERE id IN (
  SELECT registration_id 
  FROM order_items 
  WHERE order_id = '25999db9'
);

-- Step 5: Verify the fix
SELECT 
  'Updated Order' as check_type,
  o.id as order_id,
  o.status as order_status,
  o.total_amount,
  p.status as payment_status,
  p.amount as payment_amount,
  r.status as registration_status,
  r.payment_status as reg_payment_status,
  r.amount_paid
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN registrations r ON r.id = oi.registration_id
WHERE o.id = '25999db9';
