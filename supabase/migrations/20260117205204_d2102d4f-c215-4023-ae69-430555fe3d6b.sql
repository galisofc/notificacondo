
-- Recreate the function to NEVER assign role when created via service_role (admin)
-- The trigger runs in auth schema context, so we need a different approach
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_first_user BOOLEAN;
  user_role app_role;
  should_assign_role BOOLEAN := true;
BEGIN
  -- Check if this is the first user (super_admin) 
  SELECT NOT EXISTS (SELECT 1 FROM profiles LIMIT 1) INTO is_first_user;
  
  -- Determine role based on context
  IF is_first_user THEN
    user_role := 'super_admin';
  ELSIF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    -- Explicit role in metadata - use it
    user_role := (NEW.raw_user_meta_data ->> 'role')::app_role;
  ELSIF NEW.raw_user_meta_data ->> 'skip_role_assignment' = 'true' THEN
    -- Edge function explicitly asked to skip role assignment
    should_assign_role := false;
  ELSIF NEW.email_confirmed_at IS NOT NULL THEN
    -- Email already confirmed at creation = admin-created user
    -- Skip role assignment, let the edge function handle it
    should_assign_role := false;
  ELSE
    -- Self-registered user (signup form) - assign sindico
    user_role := 'sindico';
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
  
  -- Assign role only if appropriate
  IF should_assign_role AND user_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix the teste@teste.com user - change from sindico to porteiro
UPDATE user_roles 
SET role = 'porteiro'
WHERE user_id = (SELECT user_id FROM profiles WHERE email = 'teste@teste.com')
AND role = 'sindico';
