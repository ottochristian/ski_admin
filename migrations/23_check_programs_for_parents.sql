-- Migration 23: Diagnostic queries to check why programs aren't showing for parents
-- Run these queries in Supabase SQL Editor to diagnose the issue

-- 1. Check the current season
SELECT 
  'Current Season Check' as check_type,
  id,
  name,
  start_date,
  end_date,
  is_current,
  status,
  club_id
FROM seasons
WHERE is_current = true
ORDER BY club_id;

-- 2. Check all programs for the 2025-2026 season
-- Replace 'YOUR_SEASON_ID' with the actual season ID from query 1
SELECT 
  'Programs for 2025-2026 Season' as check_type,
  p.id,
  p.name,
  p.description,
  p.status,
  p.season_id,
  p.club_id,
  s.name as season_name,
  c.name as club_name,
  (SELECT COUNT(*) FROM sub_programs sp WHERE sp.program_id = p.id) as total_sub_programs,
  (SELECT COUNT(*) FROM sub_programs sp WHERE sp.program_id = p.id AND sp.is_active = true) as active_sub_programs
FROM programs p
LEFT JOIN seasons s ON s.id = p.season_id
LEFT JOIN clubs c ON c.id = p.club_id
WHERE s.name = '2025-2026' OR s.name = '2025-2026'
ORDER BY p.club_id, p.name;

-- 3. Check programs by club (replace 'YOUR_CLUB_ID' with your actual club ID)
-- First, get your club IDs:
SELECT 
  'Available Clubs' as check_type,
  id,
  name,
  slug
FROM clubs
ORDER BY name;

-- Then check programs for a specific club (replace 'YOUR_CLUB_ID' with actual ID)
SELECT 
  'Programs for Club' as check_type,
  p.id,
  p.name,
  p.status,
  p.season_id,
  p.club_id,
  s.name as season_name,
  s.is_current as season_is_current,
  COUNT(sp.id) as total_sub_programs,
  COUNT(CASE WHEN sp.is_active = true THEN 1 END) as active_sub_programs
FROM programs p
LEFT JOIN seasons s ON s.id = p.season_id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE p.club_id = 'YOUR_CLUB_ID'  -- Replace with actual club ID
GROUP BY p.id, p.name, p.status, p.season_id, p.club_id, s.name, s.is_current
ORDER BY s.is_current DESC, p.name;

-- 4. Detailed check: Programs with their sub-programs for current season
SELECT 
  'Detailed Program Check' as check_type,
  p.id as program_id,
  p.name as program_name,
  p.status as program_status,
  p.season_id,
  s.name as season_name,
  s.is_current,
  p.club_id,
  c.name as club_name,
  sp.id as sub_program_id,
  sp.name as sub_program_name,
  sp.is_active as sub_program_is_active,
  sp.registration_fee
FROM programs p
INNER JOIN seasons s ON s.id = p.season_id
INNER JOIN clubs c ON c.id = p.club_id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE s.is_current = true
  AND (p.status = 'ACTIVE' OR p.status IS NULL)
ORDER BY c.name, p.name, sp.name;

-- 5. Summary: Count programs by status and club
SELECT 
  'Program Summary' as check_type,
  c.name as club_name,
  s.name as season_name,
  s.is_current,
  p.status,
  COUNT(DISTINCT p.id) as program_count,
  COUNT(DISTINCT sp.id) as total_sub_programs,
  COUNT(DISTINCT CASE WHEN sp.is_active = true THEN sp.id END) as active_sub_programs
FROM programs p
LEFT JOIN seasons s ON s.id = p.season_id
LEFT JOIN clubs c ON c.id = p.club_id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
GROUP BY c.name, s.name, s.is_current, p.status
ORDER BY c.name, s.is_current DESC, p.status;

-- 6. Quick check: What should parents see?
-- This simulates what the parent portal query should return
SELECT 
  'What Parents Should See' as check_type,
  p.id,
  p.name as program_name,
  p.status,
  s.name as season_name,
  c.name as club_name,
  sp.id as sub_program_id,
  sp.name as sub_program_name,
  sp.is_active,
  sp.registration_fee
FROM programs p
INNER JOIN seasons s ON s.id = p.season_id AND s.is_current = true
INNER JOIN clubs c ON c.id = p.club_id
INNER JOIN sub_programs sp ON sp.program_id = p.id AND sp.is_active = true
WHERE (p.status = 'ACTIVE' OR p.status IS NULL)
ORDER BY c.name, p.name, sp.name;
