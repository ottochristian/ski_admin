CREATE TABLE IF NOT EXISTS impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email TEXT NOT NULL,
  target_role TEXT NOT NULL,
  club_slug TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin ON impersonation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_started ON impersonation_logs(started_at DESC);

-- Only accessible via service role key — no public access
ALTER TABLE impersonation_logs ENABLE ROW LEVEL SECURITY;
