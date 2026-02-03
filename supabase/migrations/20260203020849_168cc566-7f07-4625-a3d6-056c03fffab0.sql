-- Adicionar coluna aos planos
ALTER TABLE plans ADD COLUMN package_notifications_limit integer NOT NULL DEFAULT 50;

-- Adicionar colunas às assinaturas
ALTER TABLE subscriptions 
  ADD COLUMN package_notifications_limit integer NOT NULL DEFAULT 50,
  ADD COLUMN package_notifications_used integer NOT NULL DEFAULT 0,
  ADD COLUMN package_notifications_extra integer NOT NULL DEFAULT 0;

-- Configuração do custo extra
INSERT INTO app_settings (key, value, description)
VALUES ('package_notification_extra_cost', '"0.10"', 'Custo por notificação de encomenda acima do limite (R$)');

-- Atualizar planos existentes com limites sugeridos
UPDATE plans SET package_notifications_limit = 20 WHERE slug = 'start';
UPDATE plans SET package_notifications_limit = 100 WHERE slug = 'essencial';
UPDATE plans SET package_notifications_limit = 500 WHERE slug = 'profissional';
UPDATE plans SET package_notifications_limit = -1 WHERE slug = 'enterprise';

-- Sincronizar assinaturas existentes com os limites dos planos
UPDATE subscriptions s
SET package_notifications_limit = p.package_notifications_limit
FROM plans p
WHERE s.plan::text = p.slug;