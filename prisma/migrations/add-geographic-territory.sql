-- ========================================
-- MIGRAÇÃO: Sistema de Atribuição Geográfica
-- ========================================
-- Adiciona campos de território geográfico nas tabelas sellers e restaurants

-- 1. Adicionar campos na tabela sellers
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS territorio_tipo VARCHAR(20) DEFAULT 'cep_legado' COMMENT 'Tipo de território: raio, polígono ou CEP antigo',
ADD COLUMN IF NOT EXISTS base_cidade VARCHAR(200) NULL COMMENT 'Cidade base do executivo (ex: Campinas, SP)',
ADD COLUMN IF NOT EXISTS base_latitude DECIMAL(10, 8) NULL COMMENT 'Latitude da base de operação',
ADD COLUMN IF NOT EXISTS base_longitude DECIMAL(11, 8) NULL COMMENT 'Longitude da base de operação',
ADD COLUMN IF NOT EXISTS raio_km INT NULL COMMENT 'Raio de atendimento em km (usado quando territorio_tipo = raio)',
ADD COLUMN IF NOT EXISTS poligono_pontos JSONB NULL COMMENT 'Array de pontos do polígono (usado quando territorio_tipo = poligono)',
ADD COLUMN IF NOT EXISTS territorio_ativo BOOLEAN DEFAULT TRUE COMMENT 'Se FALSE, usa sistema antigo de zonas CEP';

-- 2. Adicionar campos na tabela restaurants
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS geocoding_data JSONB NULL COMMENT 'Cache dos dados de geocoding',
ADD COLUMN IF NOT EXISTS geocoding_atualizado_em TIMESTAMPTZ NULL COMMENT 'Última atualização das coordenadas';

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_restaurants_coords ON restaurants(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sellers_territorio_ativo ON sellers(territorio_ativo) WHERE territorio_ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_sellers_territorio_tipo ON sellers(territorio_tipo);

-- ========================================
-- CONFIGURAÇÃO PRÉ-DEFINIDA DOS EXECUTIVOS
-- ========================================
-- IMPORTANTE: Ajustar os WHERE conforme os nomes dos executivos no banco

-- CELIO FERNANDO - Sorocaba e Região
UPDATE sellers SET 
  territorio_tipo = 'raio',
  base_cidade = 'Sorocaba, SP',
  base_latitude = -23.5015,
  base_longitude = -47.4526,
  raio_km = 100,
  territorio_ativo = TRUE
WHERE name ILIKE '%Celio%' OR name ILIKE '%CELIO%';

-- CÍCERO - ABC Paulista
UPDATE sellers SET 
  territorio_tipo = 'raio',
  base_cidade = 'Santo André, SP',
  base_latitude = -23.6536,
  base_longitude = -46.5286,
  raio_km = 15,
  territorio_ativo = TRUE
WHERE name ILIKE '%Cicero%' OR name ILIKE '%CICERO%' OR name ILIKE '%Cícero%';

-- GLAUBER - Campinas e RMC
UPDATE sellers SET 
  territorio_tipo = 'raio',
  base_cidade = 'Campinas, SP',
  base_latitude = -22.9099,
  base_longitude = -47.0626,
  raio_km = 70,
  territorio_ativo = TRUE
WHERE name ILIKE '%Glauber%' OR name ILIKE '%GLAUBER%';

-- REGINALDO - Zona Leste + Vale do Paraíba
UPDATE sellers SET 
  territorio_tipo = 'raio',
  base_cidade = 'São Paulo - Zona Leste (Tatuapé), SP',
  base_latitude = -23.5400,
  base_longitude = -46.5757,
  raio_km = 140,
  territorio_ativo = TRUE
WHERE name ILIKE '%Reginaldo%' OR name ILIKE '%REGINALDO%';

-- JOÃO SANTANA - SP Regiões Centrais
UPDATE sellers SET 
  territorio_tipo = 'raio',
  base_cidade = 'São Paulo - Centro (Av. Paulista), SP',
  base_latitude = -23.5617,
  base_longitude = -46.6561,
  raio_km = 35,
  territorio_ativo = TRUE
WHERE name ILIKE '%João%' OR name ILIKE '%JOAO%' OR name ILIKE '%Santana%';

