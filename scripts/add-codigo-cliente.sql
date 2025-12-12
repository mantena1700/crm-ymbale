-- Adicionar coluna codigo_cliente na tabela restaurants
-- Execute este SQL no banco de dados

-- Adicionar coluna se não existir
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS codigo_cliente INTEGER UNIQUE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_restaurants_codigo_cliente ON restaurants(codigo_cliente);

-- Função para gerar o próximo código de cliente
CREATE OR REPLACE FUNCTION get_next_codigo_cliente()
RETURNS INTEGER AS $$
DECLARE
    next_code INTEGER;
    start_code INTEGER := 10000;
BEGIN
    -- Buscar o maior código existente
    SELECT COALESCE(MAX(codigo_cliente), start_code - 1) INTO next_code
    FROM restaurants
    WHERE codigo_cliente IS NOT NULL;
    
    -- Retornar o próximo código (incrementar)
    RETURN next_code + 1;
END;
$$ LANGUAGE plpgsql;

-- Atualizar todos os restaurantes que não têm código
-- Gerar códigos sequenciais começando em 10000
DO $$
DECLARE
    r RECORD;
    current_code INTEGER := 10000;
BEGIN
    -- Atualizar restaurantes sem código, ordenados por data de criação
    FOR r IN 
        SELECT id 
        FROM restaurants 
        WHERE codigo_cliente IS NULL 
        ORDER BY created_at ASC
    LOOP
        -- Verificar se o código já existe
        WHILE EXISTS (SELECT 1 FROM restaurants WHERE codigo_cliente = current_code) LOOP
            current_code := current_code + 1;
        END LOOP;
        
        -- Atribuir o código
        UPDATE restaurants 
        SET codigo_cliente = current_code 
        WHERE id = r.id;
        
        current_code := current_code + 1;
    END LOOP;
END $$;

