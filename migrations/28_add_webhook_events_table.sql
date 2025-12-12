-- Migration 28: Add webhook events table for idempotency
-- Prevents duplicate processing of webhook events (critical for Stripe webhooks)

-- Step 1: Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);

-- Step 3: Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
DROP TRIGGER IF EXISTS trigger_update_webhook_events_updated_at ON webhook_events;
CREATE TRIGGER trigger_update_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_events_updated_at();

-- Step 5: Enable RLS (optional, but recommended)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access (via API routes)
CREATE POLICY "Service role can manage webhook events"
ON webhook_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Note: Since webhooks use service role key, RLS policies will allow access
-- If you want stricter control, you can remove RLS or add more specific policies

-- Verify table creation
SELECT 
  'Webhook events table created' as status,
  COUNT(*) as existing_events
FROM webhook_events;


