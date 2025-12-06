-- Migration 19: Add Jackson and GTSSF Clubs
-- Creates two new clubs for the multi-club system

-- Insert Jackson club
INSERT INTO clubs (name, slug, primary_color) 
VALUES ('Jackson', 'jackson', '#3B82F6')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color;

-- Insert GTSSF club
INSERT INTO clubs (name, slug, primary_color) 
VALUES ('GTSSF', 'gtssf', '#3B82F6')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color;

-- Verify clubs were created
SELECT 
  'Clubs created successfully' as status,
  id,
  name,
  slug,
  primary_color
FROM clubs
WHERE slug IN ('jackson', 'gtssf')
ORDER BY name;
