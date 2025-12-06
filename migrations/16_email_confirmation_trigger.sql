-- Migration 16: Create trigger to handle profile creation when user confirms email
-- This ensures the profile is created automatically when the user confirms their email

-- Function to create profile when user is confirmed
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger fires when a user's email is confirmed
  -- NEW.email_confirmed_at will be set when confirmation happens
  
  -- Only create profile if it doesn't exist and email is confirmed
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    -- User just confirmed their email - create profile
    INSERT INTO public.profiles (
      id,
      email,
      role,
      club_id
    )
    SELECT
      NEW.id,
      NEW.email,
      'parent'::user_role,  -- Default role
      (SELECT id FROM clubs WHERE slug = 'default' LIMIT 1)  -- Default club
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = NEW.id
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We can't create triggers directly on auth.users from public schema
-- Instead, we'll use Supabase's built-in webhook system or handle it in the app
-- For now, we'll create the profile on first successful login after confirmation
