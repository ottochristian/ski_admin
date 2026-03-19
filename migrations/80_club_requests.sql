-- Club Requests: prospective clubs submit requests before being provisioned
CREATE TABLE IF NOT EXISTS club_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  club_name TEXT NOT NULL,
  slug_requested TEXT,
  athlete_count_estimate TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  provisioned_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_requests_status ON club_requests(status);
CREATE INDEX IF NOT EXISTS idx_club_requests_user_id ON club_requests(user_id);
