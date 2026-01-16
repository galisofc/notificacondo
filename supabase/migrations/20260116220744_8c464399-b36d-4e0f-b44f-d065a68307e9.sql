-- Fix handle_new_user trigger to NOT automatically assign sindico role
-- The role assignment should be handled by the edge functions (create-sindico, create-porteiro)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create the profile, do NOT assign any role automatically
  -- Roles will be assigned by the appropriate edge function (create-sindico, create-porteiro, etc.)
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  RETURN NEW;
END;
$$;