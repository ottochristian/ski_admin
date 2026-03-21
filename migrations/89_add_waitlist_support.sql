-- Migration 89: Add waitlist support
--
-- Adds max_capacity to groups table so capacity can be set at group level.
-- Sub-programs already have max_capacity.
-- Program-level capacity is derived (sum of sub-program capacities).
--
-- The registrations.status TEXT column already accepts any value.
-- Valid statuses after this migration:
--   'pending'    — registration created, awaiting payment
--   'confirmed'  — payment received (or free program confirmed)
--   'waitlisted' — program/sub-program is at capacity; no payment collected
--   'cancelled'  — registration cancelled

ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_capacity INTEGER;

COMMENT ON COLUMN groups.max_capacity IS 'Maximum number of athletes allowed in this group. NULL = unlimited.';
COMMENT ON COLUMN sub_programs.max_capacity IS 'Maximum number of athletes for this sub-program. NULL = unlimited.';
