-- Migration 15: Create profile automatically when user logs in (if it doesn't exist)
-- This handles the case where email confirmation is required

-- Function to ensure profile exists when user logs in
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile exists, if not create a basic one
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'parent'::user_role  -- Default role, can be updated
  )
  ON CONFLICT (id) DO UPDATE
  SET email = NEW.email;  -- Update email if it changed
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We can't create a trigger on auth.users directly from public schema
-- Instead, we'll handle this in the login flow or use a webhook
-- For now, the signup will try to create the profile, and if it fails,
-- the user can complete profile setup on first login
