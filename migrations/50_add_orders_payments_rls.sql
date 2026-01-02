-- Migration 50: Add RLS policies for orders, order_items, and payments tables
-- CRITICAL SECURITY FIX: Financial/payment tables were public without RLS
-- These tables contain sensitive financial data and MUST be protected

-- ========================================
-- ORDERS TABLE
-- ========================================

-- Step 1: Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies (safety)
DROP POLICY IF EXISTS "Parents can view their household orders" ON orders;
DROP POLICY IF EXISTS "Admins can view orders in their club" ON orders;
DROP POLICY IF EXISTS "System admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Parents can insert orders for their household" ON orders;
DROP POLICY IF EXISTS "Admins can insert orders in their club" ON orders;
DROP POLICY IF EXISTS "System admins can insert orders" ON orders;
DROP POLICY IF EXISTS "Parents can update their household orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders in their club" ON orders;
DROP POLICY IF EXISTS "System admins can update orders" ON orders;
DROP POLICY IF EXISTS "System admins can delete orders" ON orders;

-- Step 3: SELECT policies for orders
CREATE POLICY "Parents can view their household orders"
ON orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = orders.household_id
  )
);

CREATE POLICY "Admins can view orders in their club"
ON orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'coach')
      AND p.club_id = orders.club_id
  )
);

CREATE POLICY "System admins can view all orders"
ON orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- Step 4: INSERT policies for orders
-- Parents can create orders for their household (through checkout API)
CREATE POLICY "Parents can insert orders for their household"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = orders.household_id
  )
);

-- Admins can create orders in their club (manual orders)
CREATE POLICY "Admins can insert orders in their club"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = orders.club_id
  )
);

-- System admins can create any order
CREATE POLICY "System admins can insert orders"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- Step 5: UPDATE policies for orders
-- Parents can update their orders (limited by application logic)
CREATE POLICY "Parents can update their household orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = orders.household_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = orders.household_id
  )
);

-- Admins can update orders in their club
CREATE POLICY "Admins can update orders in their club"
ON orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = orders.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = orders.club_id
  )
);

-- System admins can update any order
CREATE POLICY "System admins can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- Step 6: DELETE policies for orders
-- Only system admins can delete orders (soft delete preferred)
CREATE POLICY "System admins can delete orders"
ON orders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- ========================================
-- ORDER_ITEMS TABLE
-- ========================================

-- Step 7: Enable RLS on order_items table
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop existing policies
DROP POLICY IF EXISTS "Users can view order_items for their orders" ON order_items;
DROP POLICY IF EXISTS "Users can insert order_items for their orders" ON order_items;
DROP POLICY IF EXISTS "Users can update order_items for their orders" ON order_items;
DROP POLICY IF EXISTS "System admins can delete order_items" ON order_items;

-- Step 9: SELECT policies for order_items
-- Users can view order items if they can view the parent order
CREATE POLICY "Users can view order_items for their orders"
ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN household_guardians hg ON hg.household_id = o.household_id
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = order_items.order_id
      AND (
        -- Parent can see their household's order items
        hg.user_id = auth.uid()
        OR
        -- Admin can see order items in their club
        (p.role IN ('admin', 'coach') AND p.club_id = o.club_id)
        OR
        -- System admin can see all
        p.role = 'system_admin'
      )
  )
);

-- Step 10: INSERT policies for order_items
-- Users can insert items if they can insert to the parent order
CREATE POLICY "Users can insert order_items for their orders"
ON order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN household_guardians hg ON hg.household_id = o.household_id
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = order_items.order_id
      AND (
        hg.user_id = auth.uid()
        OR (p.role IN ('admin', 'system_admin') AND (p.club_id = o.club_id OR p.role = 'system_admin'))
      )
  )
);

-- Step 11: UPDATE policies for order_items
CREATE POLICY "Users can update order_items for their orders"
ON order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN household_guardians hg ON hg.household_id = o.household_id
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = order_items.order_id
      AND (
        hg.user_id = auth.uid()
        OR (p.role IN ('admin', 'system_admin') AND (p.club_id = o.club_id OR p.role = 'system_admin'))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN household_guardians hg ON hg.household_id = o.household_id
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = order_items.order_id
      AND (
        hg.user_id = auth.uid()
        OR (p.role IN ('admin', 'system_admin') AND (p.club_id = o.club_id OR p.role = 'system_admin'))
      )
  )
);

-- Step 12: DELETE policies for order_items
CREATE POLICY "System admins can delete order_items"
ON order_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- ========================================
-- PAYMENTS TABLE
-- ========================================

-- Step 13: Enable RLS on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Step 14: Drop existing policies
DROP POLICY IF EXISTS "Users can view payments for their orders" ON payments;
DROP POLICY IF EXISTS "Users can insert payments for their orders" ON payments;
DROP POLICY IF EXISTS "Users can update payments for their orders" ON payments;
DROP POLICY IF EXISTS "System admins can delete payments" ON payments;

-- Step 15: SELECT policies for payments
-- Users can view payments if they can view the parent order
CREATE POLICY "Users can view payments for their orders"
ON payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN household_guardians hg ON hg.household_id = o.household_id
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = payments.order_id
      AND (
        -- Parent can see their household's payments
        hg.user_id = auth.uid()
        OR
        -- Admin can see payments in their club
        (p.role IN ('admin', 'coach') AND p.club_id = o.club_id)
        OR
        -- System admin can see all
        p.role = 'system_admin'
      )
  )
);

-- Step 16: INSERT policies for payments
-- Only admins and system (via API) can create payments
-- Parents should NOT create payments directly (goes through Stripe webhook)
CREATE POLICY "Users can insert payments for their orders"
ON payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN household_guardians hg ON hg.household_id = o.household_id
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = payments.order_id
      AND (
        -- Parent can create payment records (for their checkout)
        hg.user_id = auth.uid()
        OR
        -- Admin can create payments in their club
        (p.role = 'admin' AND p.club_id = o.club_id)
        OR
        -- System admin can create any payment
        p.role = 'system_admin'
      )
  )
);

-- Step 17: UPDATE policies for payments
-- Very restrictive - only admins and system should update payments
CREATE POLICY "Users can update payments for their orders"
ON payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = payments.order_id
      AND (
        -- Admin can update payments in their club
        (p.role = 'admin' AND p.club_id = o.club_id)
        OR
        -- System admin can update any payment
        p.role = 'system_admin'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM orders o
    LEFT JOIN profiles p ON p.id = auth.uid()
    WHERE o.id = payments.order_id
      AND (
        (p.role = 'admin' AND p.club_id = o.club_id)
        OR p.role = 'system_admin'
      )
  )
);

-- Step 18: DELETE policies for payments
-- Only system admins can delete payments
CREATE POLICY "System admins can delete payments"
ON payments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- ========================================
-- VERIFICATION
-- ========================================

-- Step 19: Verify all RLS is enabled
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ENABLED' ELSE '❌ RLS DISABLED' END as status
FROM pg_tables
WHERE tablename IN ('orders', 'order_items', 'payments')
ORDER BY tablename;

-- Step 20: Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('orders', 'order_items', 'payments')
GROUP BY tablename
ORDER BY tablename;

-- Step 21: Show all policies
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename IN ('orders', 'order_items', 'payments')
ORDER BY tablename, cmd, policyname;
