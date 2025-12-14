-- Check which club the currently logged in user belongs to

SELECT 
  'Your Profile Info' as check_type,
  p.id,
  p.email,
  p.role,
  p.club_id,
  c.name as club_name,
  c.slug as club_slug
FROM profiles p
LEFT JOIN clubs c ON c.id = p.club_id
WHERE p.email LIKE '%ottilieotto%'
ORDER BY p.email;

-- Check all admin accounts
SELECT 
  'All Admin Accounts' as check_type,
  p.email,
  p.role,
  p.club_id,
  c.name as club_name,
  c.slug as club_slug
FROM profiles p
LEFT JOIN clubs c ON c.id = p.club_id
WHERE p.role IN ('admin', 'system_admin')
ORDER BY p.email;
