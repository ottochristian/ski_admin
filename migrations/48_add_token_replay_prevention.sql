-- Migration 48: Token Replay Prevention and Rate Limiting
-- Prevents reuse of setup/verification tokens
-- Moves rate limiting from memory to database

BEGIN;

-- ============================================================================
-- 1. Used Tokens Table (Replay Attack Prevention)
-- ============================================================================
CREATE TABLE IF NOT EXISTS used_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jti text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token_type text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_used_tokens_jti ON used_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_used_tokens_user_id ON used_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_used_tokens_expires_at ON used_tokens(expires_at);

-- Cleanup expired tokens automatically
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM used_tokens
  WHERE expires_at < now();
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_expired_tokens TO authenticated, service_role;

COMMENT ON TABLE used_tokens IS 'Stores used JWT tokens to prevent replay attacks';
COMMENT ON COLUMN used_tokens.jti IS 'JWT ID - unique identifier for each token';

-- ============================================================================
-- 2. Rate Limits Table (Database-backed rate limiting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- Email, IP, or user ID
  action text NOT NULL, -- 'otp_request', 'login_attempt', etc.
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one record per identifier+action combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_identifier_action 
ON rate_limits(identifier, action);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);

-- Cleanup expired rate limit records
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at < now();
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits TO authenticated, service_role;

-- Function to check and update rate limit (atomic operation)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_requests integer,
  p_window_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record rate_limits;
  v_window_end timestamptz;
  v_allowed boolean;
BEGIN
  -- Calculate window end time
  v_window_end := now() + (p_window_minutes || ' minutes')::interval;
  
  -- Try to get existing record with row lock
  SELECT * INTO v_record
  FROM rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
  FOR UPDATE;
  
  -- If record exists and not expired
  IF FOUND AND v_record.expires_at > now() THEN
    -- Check if under limit
    IF v_record.request_count < p_max_requests THEN
      -- Increment counter
      UPDATE rate_limits
      SET request_count = request_count + 1,
          updated_at = now()
      WHERE identifier = p_identifier
        AND action = p_action;
      
      v_allowed := true;
    ELSE
      -- Over limit
      v_allowed := false;
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', v_allowed,
      'current_count', v_record.request_count + 1,
      'max_requests', p_max_requests,
      'reset_at', v_record.expires_at
    );
  ELSE
    -- No record or expired - create new
    INSERT INTO rate_limits (
      identifier,
      action,
      request_count,
      window_start,
      expires_at
    ) VALUES (
      p_identifier,
      p_action,
      1,
      now(),
      v_window_end
    )
    ON CONFLICT (identifier, action)
    DO UPDATE SET
      request_count = 1,
      window_start = now(),
      expires_at = v_window_end,
      updated_at = now();
    
    RETURN jsonb_build_object(
      'allowed', true,
      'current_count', 1,
      'max_requests', p_max_requests,
      'reset_at', v_window_end
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, service_role, anon;

COMMENT ON FUNCTION check_rate_limit IS 'Atomically check and update rate limits';

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================

-- used_tokens: only service role can access
ALTER TABLE used_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON used_tokens
  FOR ALL
  USING (false); -- No one can access via RLS

-- rate_limits: service role and anon (for unauthenticated rate limiting)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON rate_limits
  FOR ALL
  USING (false); -- No one can access via RLS, use functions instead

-- ============================================================================
-- 4. Scheduled Cleanup (Run daily)
-- ============================================================================

-- Note: In production, set up a cron job or use pg_cron extension:
-- SELECT cron.schedule('cleanup-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens()');
-- SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', 'SELECT cleanup_expired_rate_limits()');

COMMIT;
