
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS idx_user_condominiums_user_cond ON public.user_condominiums (user_id, condominium_id);
