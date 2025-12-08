-- Adicionar coluna photo_url na tabela sellers
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

-- Comentário na coluna
COMMENT ON COLUMN sellers.photo_url IS 'URL da foto do vendedor';

