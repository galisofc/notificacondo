-- Atualizar a função de auditoria para usar uma variável de sessão quando auth.uid() não está disponível
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Primeiro tenta pegar de uma variável de sessão customizada (definida por edge functions)
  BEGIN
    current_user_id := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;
  
  -- Se não encontrou, usa auth.uid()
  IF current_user_id IS NULL THEN
    current_user_id := auth.uid();
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, action, record_id, new_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(NEW), current_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW), current_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, action, record_id, old_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, to_jsonb(OLD), current_user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;