-- Migration 90: Set default max_capacity of 10 for groups
ALTER TABLE groups ALTER COLUMN max_capacity SET DEFAULT 10;
