-- Adicionar configurações de dias de trial e dias úteis para vencimento
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('default_trial_days', '7', 'Número de dias do período de trial padrão para novos condomínios'),
  ('invoice_due_days', '5', 'Número de dias úteis para vencimento das faturas após emissão')
ON CONFLICT (key) DO NOTHING;