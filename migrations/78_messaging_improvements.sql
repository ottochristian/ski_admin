-- Migration 78: Messaging system improvements
-- Fixes RLS gaps, adds threading columns, delivery tracking, and indexes

-- 1. Fix RLS: recipients need to read message content
CREATE POLICY "Recipients can view messages sent to them"
  ON messages FOR SELECT
  USING (
    id IN (
      SELECT message_id FROM message_recipients
      WHERE recipient_id = auth.uid()
    )
  );

-- 2. Admins can view all messages in their club
CREATE POLICY "Admins can view club messages"
  ON messages FOR SELECT
  USING (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );

-- 3. Add reply threading support (nullable — Phase 1 leaves it NULL)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES messages(id),
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'broadcast'
    CHECK (message_type IN ('broadcast', 'reply', 'direct'));

-- 4. Track email delivery
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_provider_id text;

-- 5. Useful indexes
CREATE INDEX IF NOT EXISTS idx_messages_club_sent ON messages(club_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_recipients_unread
  ON message_recipients(recipient_id, read_at)
  WHERE read_at IS NULL;
