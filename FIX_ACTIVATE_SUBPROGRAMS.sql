-- Quick fix: Activate all sub-programs for GTSSF current season

-- 1. Show current inactive sub-programs
SELECT 
  'Before Activation' as status,
  sp.id,
  sp.name,
  sp.status,
  p.name as program_name
FROM sub_programs sp
JOIN programs p ON sp.program_id = p.id
JOIN seasons s ON p.season_id = s.id
JOIN clubs c ON p.club_id = c.id
WHERE c.slug = 'gtssf' 
  AND s.is_current = true
  AND (sp.status = 'INACTIVE' OR sp.status IS NULL)
ORDER BY p.name, sp.name;

-- 2. Activate all sub-programs for current GTSSF season
UPDATE sub_programs
SET status = 'ACTIVE'
FROM programs p
JOIN seasons s ON p.season_id = s.id
JOIN clubs c ON p.club_id = c.id
WHERE sub_programs.program_id = p.id
  AND c.slug = 'gtssf'
  AND s.is_current = true
  AND (sub_programs.status = 'INACTIVE' OR sub_programs.status IS NULL);

-- 3. Also ensure programs are active
UPDATE programs
SET status = 'ACTIVE'
FROM seasons s
JOIN clubs c ON s.club_id = c.id
WHERE programs.season_id = s.id
  AND c.slug = 'gtssf'
  AND s.is_current = true
  AND (programs.status = 'INACTIVE' OR programs.status IS NULL);

-- 4. Verify activation
SELECT 
  'After Activation' as status,
  sp.id,
  sp.name,
  sp.status,
  sp.registration_fee,
  p.name as program_name,
  p.status as program_status
FROM sub_programs sp
JOIN programs p ON sp.program_id = p.id
JOIN seasons s ON p.season_id = s.id
JOIN clubs c ON p.club_id = c.id
WHERE c.slug = 'gtssf' 
  AND s.is_current = true
ORDER BY p.name, sp.name;
