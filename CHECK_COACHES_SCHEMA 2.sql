-- Check the actual schema of coaches table to find the correct column name

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'coaches'
ORDER BY ordinal_position;
