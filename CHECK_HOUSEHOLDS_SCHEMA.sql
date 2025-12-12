-- Check the actual schema of households table

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'households'
ORDER BY ordinal_position;
