-- Quick check: Programs for 2025-2026 season and the club
-- Use the IDs from query 1 results:
-- Season ID: 37fbe813-0737-4cd1-9094-b3e120625bd2
-- Club ID: 3dce1b99-de59-461e-9a00-ab4cdada9ae6

-- Check programs for this specific season and club
SELECT 
  'Programs Check' as check_type,
  p.id,
  p.name,
  p.status,
  p.season_id,
  p.club_id,
  COUNT(sp.id) as total_sub_programs,
  COUNT(CASE WHEN sp.is_active = true THEN 1 END) as active_sub_programs
FROM programs p
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE p.season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2'
  AND p.club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6'
GROUP BY p.id, p.name, p.status, p.season_id, p.club_id
ORDER BY p.name;

-- Detailed view: Show programs with their sub-programs
SELECT 
  p.id as program_id,
  p.name as program_name,
  p.status as program_status,
  sp.id as sub_program_id,
  sp.name as sub_program_name,
  sp.is_active as sub_program_is_active,
  sp.registration_fee
FROM programs p
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE p.season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2'
  AND p.club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6'
ORDER BY p.name, sp.name;

-- Check what the parent portal query should return
SELECT 
  p.id,
  p.name as program_name,
  p.status,
  sp.id as sub_program_id,
  sp.name as sub_program_name,
  sp.is_active,
  sp.registration_fee
FROM programs p
INNER JOIN sub_programs sp ON sp.program_id = p.id
WHERE p.season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2'
  AND p.club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6'
  AND (p.status = 'ACTIVE' OR p.status IS NULL)
  AND sp.is_active = true
ORDER BY p.name, sp.name;
