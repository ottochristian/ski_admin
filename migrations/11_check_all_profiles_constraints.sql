-- Migration 11: Check all constraints on profiles table
-- This will help us understand what foreign keys exist

-- Check ALL foreign keys on profiles table (any column)
SELECT
    tc.constraint_name,
    kcu.column_name,
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

-- Check ALL constraints on profiles table
SELECT
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints
WHERE table_name = 'profiles'
ORDER BY constraint_type, constraint_name;

-- Check if profiles.id has any constraints at all
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND column_name = 'id';
