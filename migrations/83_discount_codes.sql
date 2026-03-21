-- Migration 83: Discount codes
-- Creates discount_codes and discount_code_uses tables with RLS

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE discount_codes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id              UUID REFERENCES seasons(id) ON DELETE SET NULL,
  code                   TEXT NOT NULL,
  description            TEXT,
  type                   TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value                  NUMERIC(10,2) NOT NULL CHECK (value > 0),
  min_order_cents        INTEGER NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
  max_uses               INTEGER,                 -- NULL = unlimited global uses
  max_uses_per_household INTEGER,                 -- NULL = unlimited per household
  max_uses_per_athlete   INTEGER,                 -- NULL = unlimited per athlete
  valid_from             TIMESTAMPTZ,
  valid_to               TIMESTAMPTZ,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, code)
);

CREATE TABLE discount_code_uses (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id                UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  household_id           UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  athlete_id             UUID REFERENCES athletes(id) ON DELETE SET NULL,
  order_id               UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_cents_applied INTEGER NOT NULL CHECK (discount_cents_applied > 0),
  applied_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_id, order_id)   -- one discount code per order
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_discount_codes_club_id ON discount_codes(club_id);
CREATE INDEX idx_discount_codes_club_code ON discount_codes(club_id, code);
CREATE INDEX idx_discount_codes_season_id ON discount_codes(season_id) WHERE season_id IS NOT NULL;
CREATE INDEX idx_discount_code_uses_code_id ON discount_code_uses(code_id);
CREATE INDEX idx_discount_code_uses_household_id ON discount_code_uses(household_id);
CREATE INDEX idx_discount_code_uses_order_id ON discount_code_uses(order_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_discount_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_discount_codes_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_uses ENABLE ROW LEVEL SECURITY;

-- discount_codes: admins see their club's codes
CREATE POLICY "Admins can manage their club discount codes"
  ON discount_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'system_admin' OR (p.role = 'admin' AND p.club_id = discount_codes.club_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'system_admin' OR (p.role = 'admin' AND p.club_id = discount_codes.club_id))
    )
  );

-- discount_codes: parents can see active codes for their club (needed for validate)
CREATE POLICY "Parents can view active codes for their club"
  ON discount_codes
  FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'parent'
        AND p.club_id = discount_codes.club_id
    )
  );

-- discount_code_uses: admins can see uses for their club's codes
CREATE POLICY "Admins can view discount code uses"
  ON discount_code_uses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM discount_codes dc
      JOIN profiles p ON p.id = auth.uid()
      WHERE dc.id = discount_code_uses.code_id
        AND (p.role = 'system_admin' OR (p.role = 'admin' AND p.club_id = dc.club_id))
    )
  );

-- discount_code_uses: households can see their own uses
CREATE POLICY "Households can view their own uses"
  ON discount_code_uses
  FOR SELECT
  USING (
    household_id IN (
      SELECT hg.household_id FROM household_guardians hg WHERE hg.user_id = auth.uid()
    )
  );

-- discount_code_uses: insert handled by API with admin client (no direct user insert)
