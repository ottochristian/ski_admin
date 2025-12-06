-- Migration 13: Find all foreign keys on profiles table
-- This will show us what profiles_id_fkey actually references

-- Method 1: Check all foreign keys
SELECT
    tc.constraint_name,
    kcu.column_name AS local_column,
    ccu.table_schema || '.' || ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'profiles'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Method 2: Check using pg_constraint (more direct)
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS foreign_table,
    af.attname AS foreign_column
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
WHERE con.conrelid = 'profiles'::regclass
    AND con.contype = 'f'
ORDER BY conname;
