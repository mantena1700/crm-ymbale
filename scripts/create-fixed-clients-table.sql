-- Criar tabela fixed_clients
-- Execute este SQL no banco de dados PostgreSQL

CREATE TABLE IF NOT EXISTS fixed_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    
    -- Cliente pode ser da base (restaurant_id) ou cadastrado manualmente
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Dados do cliente fixo (para cadastro manual)
    client_name VARCHAR(255),
    client_address JSONB,
    
    -- Configuração de recorrência
    recurrence_type VARCHAR(20) NOT NULL,
    monthly_days JSONB DEFAULT '[]'::jsonb,
    weekly_days JSONB DEFAULT '[]'::jsonb,
    
    -- Configuração de proximidade
    radius_km DECIMAL(5,2) DEFAULT 10.0,
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_fixed_clients_seller_id ON fixed_clients(seller_id);
CREATE INDEX IF NOT EXISTS idx_fixed_clients_restaurant_id ON fixed_clients(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_fixed_clients_active ON fixed_clients(active) WHERE active = true;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_fixed_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fixed_clients_updated_at ON fixed_clients;
CREATE TRIGGER update_fixed_clients_updated_at
    BEFORE UPDATE ON fixed_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_fixed_clients_updated_at();
