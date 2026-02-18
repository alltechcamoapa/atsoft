-- FIX: Ensure user creation trigger is robust
-- Run this in Supabase SQL Editor

-- 1. Ensure a default role exists (crucial for the trigger)
INSERT INTO public.roles (name, description)
VALUES ('Usuario', 'Rol por defecto')
ON CONFLICT (name) DO NOTHING;

-- 2. Improve the trigger function to handle missing roles/errors gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id UUID;
  v_username TEXT;
  v_fullname TEXT;
BEGIN
  -- Get default values
  v_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_fullname := COALESCE(new.raw_user_meta_data->>'full_name', new.email);

  -- Try to find 'Usuario' role
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Usuario' LIMIT 1;
  
  -- Fallback: If 'Usuario' doesn't exist, pick ANY role to avoid NOT NULL violation
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles LIMIT 1;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, username, full_name, role_id, is_active, email)
  VALUES (
    new.id,
    v_username,
    v_fullname,
    v_role_id,
    true,
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    -- Don't overwrite existing username/name on conflict unless necessary
    updated_at = now();
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Should we allow user creation even if profile fails? 
  -- Ideally no, but "Database error" is annoying. 
  -- For now, let's re-raise to see the error, but the fix above (role check) usually solves it.
  RAISE EXCEPTION 'Failed to create profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
