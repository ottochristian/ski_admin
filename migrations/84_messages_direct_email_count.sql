-- Track count of direct (non-household) email recipients per message
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS direct_email_count integer NOT NULL DEFAULT 0;
