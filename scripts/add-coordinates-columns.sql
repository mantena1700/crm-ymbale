-- Adicionar colunas latitude e longitude na tabela restaurants
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Adicionar colunas latitude e longitude na tabela fixed_clients
ALTER TABLE fixed_clients 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Criar índices para melhorar performance de queries geográficas
CREATE INDEX IF NOT EXISTS idx_restaurants_coordinates ON restaurants(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fixed_clients_coordinates ON fixed_clients(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

