-- Check if programs have the same club_id as your profile
-- Your profile club_id: 3dce1b99-de59-461e-9a00-ab4cdada9ae6

-- Check programs
SELECT id, name, status, club_id 
FROM programs 
WHERE status = 'ACTIVE'
LIMIT 10;

-- Check if programs match your club_id
SELECT 
  COUNT(*) FILTER (WHERE club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6') as matching_club,
  COUNT(*) FILTER (WHERE club_id IS NULL) as null_club_id,
  COUNT(*) FILTER (WHERE club_id != '3dce1b99-de59-461e-9a00-ab4cdada9ae6' AND club_id IS NOT NULL) as different_club,
  COUNT(*) as total_active
FROM programs 
WHERE status = 'ACTIVE';

-- If programs don't have your club_id, run this to fix it:
-- UPDATE programs 
-- SET club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6'
-- WHERE club_id IS NULL OR club_id != '3dce1b99-de59-461e-9a00-ab4cdada9ae6';

