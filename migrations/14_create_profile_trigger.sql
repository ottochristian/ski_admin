-- Migration 14: Create trigger to auto-create profile when user signs up
-- This is a more reliable approach than trying to create it manually

-- First, let's create a function that will be called by the trigger
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
  IF default_club_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, club_id)
    VALUES (
      NEW.id,
      NEW.email,
      'parent'::user_role,  -- Default to parent, can be updated later
      default_club_id
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger that fires when a user is created in auth.users
-- Note: This requires the trigger to be in the auth schema, which might not be possible
-- So we'll use a different approach - modify the signup to handle email confirmation

-- Actually, let's check if email confirmation is required first
-- If it is, we need to handle the profile creation after confirmation
