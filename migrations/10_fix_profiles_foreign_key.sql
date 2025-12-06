-- Migration 10: Fix profiles foreign key constraint
-- Check and fix the foreign key from profiles.id to auth.users.id

-- First, check what foreign keys exist on profiles
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'profiles'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Drop the existing foreign key if it exists (it might be incorrectly configured)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Recreate the foreign key correctly pointing to auth.users.id
-- Note: This requires the auth schema to be accessible
ALTER TABLE profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Verify the constraint
SELECT
    'Foreign key constraint fixed' as status,
    constraint_name,
    table_name,
    column_name
FROM information_schema.key_column_usage
WHERE table_name = 'profiles'
    AND constraint_name = 'profiles_id_fkey';
