-- Migration 18: Fix handle_new_user function to provide club_id
-- The trigger is trying to create a profile but club_id is NULL, causing the error

-- Update the function to get a default club_id
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
      'parent'::user_role,  -- Default to parent
      default_club_id
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verify the function was updated
SELECT 
  'Function updated successfully' as status,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';
