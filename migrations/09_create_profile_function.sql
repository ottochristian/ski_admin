-- Migration 09: Create function to handle profile creation during signup
-- This function runs with SECURITY DEFINER, bypassing RLS for profile creation

-- Create function to handle profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be called by a trigger, but we can also call it directly
  -- For now, we'll create it but not set up the trigger (manual profile creation)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function specifically for creating profiles during signup
-- This can be called from the client with the user's auth token
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
  max_retries INTEGER := 10;  -- Increased retries for email confirmation scenarios
BEGIN
  -- Retry mechanism: Wait for user to be committed to auth.users
  -- This handles timing issues where signUp() hasn't fully committed yet
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM auth.users WHERE id = p_user_id
    ) INTO user_exists;
    
    IF user_exists THEN
      EXIT;  -- User exists, proceed
    END IF;
    
    retry_count := retry_count + 1;
    IF retry_count >= max_retries THEN
      -- If email confirmation is required, user won't exist until they confirm
      -- In this case, we'll create the profile anyway and let the foreign key
      -- constraint be deferred or handled by a trigger
      -- For now, just return without error - profile creation will happen on first login
      RAISE WARNING 'User does not exist in auth.users after % retries. This may be due to email confirmation requirement. User ID: %', max_retries, p_user_id;
      RETURN;  -- Exit without creating profile - will be created later
    END IF;
    
    -- Wait 300ms before retrying (longer wait)
    PERFORM pg_sleep(0.3);
  END LOOP;
  
  -- Now insert the profile, or update club_id if it already exists (from trigger)
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
    p_role::user_role,  -- Cast TEXT to user_role enum
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;

-- Verify function was created
SELECT 
  'Function created successfully' as status,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_user_profile';
