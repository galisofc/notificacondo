
-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function to properly handle role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_first_user BOOLEAN;
  user_role app_role;
BEGIN
  -- Check if this is the first user (super_admin) 
  SELECT NOT EXISTS (SELECT 1 FROM profiles LIMIT 1) INTO is_first_user;
  
  -- Determine role based on context
  IF is_first_user THEN
    user_role := 'super_admin';
  ELSIF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    user_role := (NEW.raw_user_meta_data ->> 'role')::app_role;
  ELSE
    -- Default to sindico for regular signups (self-registration)
    -- BUT only if the user is signing up themselves (not created by admin)
    -- Edge functions use admin.createUser which we can detect by checking if confirmed
    -- If email is already confirmed at creation time, it's likely an admin-created user
    -- In that case, we DON'T assign any role - let the edge function handle it
    IF NEW.email_confirmed_at IS NOT NULL THEN
      -- Admin-created user (e.g., porteiro via edge function)
      -- Do NOT assign any role here - let the edge function do it
      user_role := NULL;
    ELSE
      -- Self-registered user (e.g., new sindico signing up)
      user_role := 'sindico';
    END IF;
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, email, phone, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'cpf'
  );
  
  -- Assign role only if determined (skip for admin-created users without explicit role)
  IF user_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix existing incorrect roles: change sindico to porteiro for users linked to condominiums via user_condominiums
-- (These are the porters that were incorrectly assigned as sindicos)
UPDATE user_roles 
SET role = 'porteiro'
WHERE user_id IN (
  SELECT DISTINCT uc.user_id 
  FROM user_condominiums uc
  JOIN user_roles ur ON ur.user_id = uc.user_id
  WHERE ur.role = 'sindico'
  AND uc.user_id NOT IN (
    -- Exclude actual sindicos (condominium owners)
    SELECT owner_id FROM condominiums
  )
);
