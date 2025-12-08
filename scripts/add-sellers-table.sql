-- Adicionar tabela de vendedores ao banco existente
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    regions JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sellers_active ON sellers(active) WHERE active = TRUE;

-- Adicionar colunas seller_id e assigned_at na tabela restaurants
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_restaurants_seller_id ON restaurants(seller_id);

-- Criar vendedores padrão
INSERT INTO sellers (name, email, regions, active) VALUES
('Vendedor 1', 'vendedor1@ymbale.com', '["Sorocaba", "Votorantim"]'::jsonb, TRUE),
('Vendedor 2', 'vendedor2@ymbale.com', '["São Paulo", "Guarulhos"]'::jsonb, TRUE),
('Vendedor 3', 'vendedor3@ymbale.com', '["Campinas", "Valinhos"]'::jsonb, TRUE),
('Vendedor 4', 'vendedor4@ymbale.com', '["Ribeirão Preto", "Sertãozinho"]'::jsonb, TRUE),
('Vendedor 5', 'vendedor5@ymbale.com', '["Outros"]'::jsonb, TRUE)
ON CONFLICT DO NOTHING;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_sellers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sellers_updated_at ON sellers;
CREATE TRIGGER update_sellers_updated_at
    BEFORE UPDATE ON sellers
    FOR EACH ROW
    EXECUTE FUNCTION update_sellers_updated_at();

-- Política RLS
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON sellers;
CREATE POLICY "Allow all operations" ON sellers FOR ALL USING (true);

