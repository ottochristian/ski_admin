-- Manual Fix for Payment Status
-- Use this if Stripe webhook didn't fire properly
-- ONLY run this after confirming payment was successful in Stripe dashboard!

-- Step 1: Identify the order that needs fixing
-- Replace 'YOUR_ORDER_ID' with the actual order ID from the registrations page
DO $$
DECLARE
  target_order_id UUID;
  target_order_amount NUMERIC;
BEGIN
  -- Find the most recent unpaid order (adjust if needed)
  SELECT id, total_amount INTO target_order_id, target_order_amount
  FROM orders
  WHERE status = 'unpaid'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF target_order_id IS NULL THEN
    RAISE NOTICE 'No unpaid orders found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Processing order: %', target_order_id;
  
  -- Step 2: Update order status to paid
  UPDATE orders
  SET 
    status = 'paid',
    updated_at = NOW()
  WHERE id = target_order_id;
  
  RAISE NOTICE 'Order status updated to paid';
  
  -- Step 3: Create payment record (if doesn't exist)
  INSERT INTO payments (
    order_id,
    amount,
    method,
    status,
    processed_at,
    stripe_checkout_session_id
  )
  SELECT 
    target_order_id,
    target_order_amount,
    'stripe',
    'succeeded',
    NOW(),
    'manual_fix_' || target_order_id
  WHERE NOT EXISTS (
    SELECT 1 FROM payments WHERE order_id = target_order_id
  );
  
  RAISE NOTICE 'Payment record created';
  
  -- Step 4: Update all registrations for this order
  UPDATE registrations r
  SET 
    status = 'confirmed',
    payment_status = 'paid',
    amount_paid = oi.amount
  FROM order_items oi
  WHERE oi.registration_id = r.id
    AND oi.order_id = target_order_id
    AND r.payment_status != 'paid';
  
  RAISE NOTICE 'Registrations updated to confirmed/paid';
  
  -- Step 5: Show what was updated
  RAISE NOTICE '--- Updated Registrations ---';
  PERFORM 
    r.id,
    a.first_name || ' ' || a.last_name as athlete,
    sp.name as program,
    r.status,
    r.payment_status
  FROM registrations r
  JOIN order_items oi ON oi.registration_id = r.id
  JOIN athletes a ON r.athlete_id = a.id
  JOIN sub_programs sp ON r.sub_program_id = sp.id
  WHERE oi.order_id = target_order_id;
  
END $$;

-- Verify the fix
SELECT 
  'Verification' as check_type,
  o.id as order_id,
  o.status as order_status,
  COUNT(r.id) as registration_count,
  COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN r.payment_status = 'paid' THEN 1 END) as paid_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN registrations r ON r.id = oi.registration_id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
GROUP BY o.id, o.status
ORDER BY o.created_at DESC;
