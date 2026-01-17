-- Update handle_new_user function to create sindico role automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Assign role for sindico (other roles like porteiro/morador are created via edge functions)
  IF user_role IN ('sindico', 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role);
  END IF;
  
  RETURN NEW;
END;
$$;