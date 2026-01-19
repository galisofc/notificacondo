-- Remover coluna expires_at da tabela packages
ALTER TABLE packages DROP COLUMN IF EXISTS expires_at;

-- Remover o default temporariamente para permitir alteração do tipo
ALTER TABLE packages ALTER COLUMN status DROP DEFAULT;

-- Recriar enum package_status sem o valor 'expirada'
ALTER TYPE package_status RENAME TO package_status_old;
CREATE TYPE package_status AS ENUM ('pendente', 'retirada');
ALTER TABLE packages ALTER COLUMN status TYPE package_status USING status::text::package_status;
DROP TYPE package_status_old;

-- Restaurar o default
ALTER TABLE packages ALTER COLUMN status SET DEFAULT 'pendente'::package_status;