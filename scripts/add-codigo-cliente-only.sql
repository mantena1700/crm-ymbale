-- Script para adicionar apenas a coluna codigo_cliente
-- Execute este SQL diretamente no banco de dados

-- Adicionar coluna se não existir
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS codigo_cliente INTEGER UNIQUE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_restaurants_codigo_cliente ON restaurants(codigo_cliente);

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name = 'codigo_cliente';

