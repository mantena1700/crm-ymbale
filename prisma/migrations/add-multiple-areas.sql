-- Adicionar campo para múltiplas áreas de cobertura
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS areas_cobertura JSONB NULL COMMENT 'Array de áreas de cobertura: [{ cidade, lat, lng, raio }]';

