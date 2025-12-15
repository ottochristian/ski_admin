-- Quick check: Compare programs between seasons for GTSSF

SELECT 
  s.name as season_name,
  s.is_current,
  COUNT(DISTINCT p.id) as program_count,
  COUNT(DISTINCT sp.id) as subprogram_count,
  COUNT(DISTINCT CASE WHEN sp.status = 'ACTIVE' THEN sp.id END) as active_subprograms,
  STRING_AGG(DISTINCT p.name, ', ') as program_names
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE c.slug = 'gtssf'
GROUP BY s.id, s.name, s.is_current
ORDER BY s.start_date DESC;
