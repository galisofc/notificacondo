-- Create a trigger function to prevent conflicting roles (sindico + porteiro)
CREATE OR REPLACE FUNCTION public.check_conflicting_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If inserting 'porteiro', check if user already has 'sindico'
  IF NEW.role = 'porteiro' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role = 'sindico'
    ) THEN
      RAISE EXCEPTION 'Usuário já possui role de síndico. Não é permitido ter roles de síndico e porteiro simultaneamente.';
    END IF;
  END IF;

  -- If inserting 'sindico', check if user already has 'porteiro'
  IF NEW.role = 'sindico' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role = 'porteiro'
    ) THEN
      RAISE EXCEPTION 'Usuário já possui role de porteiro. Não é permitido ter roles de síndico e porteiro simultaneamente.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS prevent_conflicting_roles ON public.user_roles;
CREATE TRIGGER prevent_conflicting_roles
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_conflicting_roles();