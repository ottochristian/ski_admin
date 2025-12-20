-- Migration 43: Prevent duplicate payment records
-- Adds unique constraint to prevent race conditions from creating duplicate payments

-- Step 1: Check for existing duplicate payments
SELECT 
  'Existing duplicate payments' as check_type,
  stripe_checkout_session_id,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as payment_ids,
  MAX(amount) as amount
FROM payments
WHERE stripe_checkout_session_id IS NOT NULL
GROUP BY stripe_checkout_session_id
HAVING COUNT(*) > 1;

-- Step 2: Remove duplicate payments (keep the first one inserted)
-- This uses a CTE to identify duplicates and delete all but the one with the lowest created timestamp
WITH duplicates AS (
  SELECT 
    id,
    stripe_checkout_session_id,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_checkout_session_id 
      ORDER BY processed_at ASC, id ASC
    ) as rn
  FROM payments
  WHERE stripe_checkout_session_id IS NOT NULL
)
DELETE FROM payments
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: Add unique constraint on stripe_checkout_session_id
-- This prevents future duplicates at the database level
ALTER TABLE payments
ADD CONSTRAINT payments_stripe_checkout_session_id_unique
UNIQUE (stripe_checkout_session_id);

-- Step 4: Also add unique constraint on stripe_payment_intent_id for extra safety
ALTER TABLE payments
ADD CONSTRAINT payments_stripe_payment_intent_id_unique
UNIQUE (stripe_payment_intent_id);

-- Step 5: Verify constraints were added
SELECT
  'Constraints added' as status,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'payments'::regclass
  AND conname LIKE '%stripe%';

-- Step 6: Verify no more duplicates exist
SELECT 
  'Verification: No duplicates should exist' as check_type,
  COUNT(*) as total_payments,
  COUNT(DISTINCT stripe_checkout_session_id) as unique_sessions,
  COUNT(*) - COUNT(DISTINCT stripe_checkout_session_id) as duplicate_count
FROM payments
WHERE stripe_checkout_session_id IS NOT NULL;
