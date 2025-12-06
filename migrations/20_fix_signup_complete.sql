-- Migration 20: Complete fix for signup - ensure handle_new_user works and clubs exist
-- This fixes the "null value in column club_id" error during signup

-- Step 1: Ensure we have at least one club (create default if missing)
INSERT INTO clubs (name, slug, primary_color) 
VALUES ('Default Club', 'default', '#3B82F6')
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Update handle_new_user function to always provide club_id
-- IMPORTANT: SET search_path = public so the function can find the clubs table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_club_id UUID;
BEGIN
  -- Get default club ID (required - profiles.club_id is NOT NULL)
  SELECT id INTO default_club_id
  FROM public.clubs
  WHERE slug = 'default'
  LIMIT 1;
  
  -- If no default club, get any club
  IF default_club_id IS NULL THEN
    SELECT id INTO default_club_id
    FROM public.clubs
    LIMIT 1;
  END IF;
  
  -- Only create profile if we have a club_id
  -- This prevents the null constraint error
  -- Note: The club_id will be updated later by create_user_profile if user selected a different club
  IF default_club_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, club_id)
    VALUES (
      NEW.id,
      NEW.email,
      'parent'::user_role,  -- Default to parent
      default_club_id
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- If no clubs exist, raise an error with a helpful message
    RAISE EXCEPTION 'No clubs found in database. Please create at least one club before allowing signups.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 2b: Update create_user_profile to update club_id if profile already exists
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_role TEXT,
  p_club_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists BOOLEAN;
  retry_count INTEGER := 0;
  max_retries INTEGER := 10;
BEGIN
  -- Retry mechanism: Wait for user to be committed to auth.users
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM auth.users WHERE id = p_user_id
    ) INTO user_exists;
    
    IF user_exists THEN
      EXIT;
    END IF;
    
    retry_count := retry_count + 1;
    IF retry_count >= max_retries THEN
      RAISE WARNING 'User does not exist in auth.users after % retries. This may be due to email confirmation requirement. User ID: %', max_retries, p_user_id;
      RETURN;
    END IF;
    
    PERFORM pg_sleep(0.3);
  END LOOP;
  
  -- Insert or update the profile
  -- If trigger already created it, update club_id to the selected one
  INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    club_id
  )
  VALUES (
    p_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_role::user_role,
    p_club_id
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    role = EXCLUDED.role,
    club_id = EXCLUDED.club_id;  -- Update club_id to the selected one
END;
$$;

-- Step 3: Verify the function was updated
SELECT 
  'Function updated successfully' as status,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- Step 4: Verify clubs exist
SELECT 
  'Clubs check' as status,
  COUNT(*) as club_count,
  array_agg(name) as club_names
FROM clubs;

-- Step 5: Check if there's a trigger on auth.users (informational only)
-- Note: We can't create triggers on auth.users from public schema,
-- but Supabase may have one set up. This query will show if one exists.
SELECT 
  'Trigger check (if any exist)' as info,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name LIKE '%user%';
