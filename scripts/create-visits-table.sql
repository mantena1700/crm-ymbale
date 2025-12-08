-- Criar tabela de visitas
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    visit_date TIMESTAMPTZ NOT NULL,
    feedback TEXT,
    outcome VARCHAR(50),
    next_visit_date TIMESTAMPTZ,
    follow_up_id UUID REFERENCES follow_ups(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_visits_restaurant_id ON visits(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_visits_seller_id ON visits(seller_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_outcome ON visits(outcome);

-- Adicionar foreign key para follow_ups se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'visits_follow_up_id_fkey'
    ) THEN
        ALTER TABLE visits 
        ADD CONSTRAINT visits_follow_up_id_fkey 
        FOREIGN KEY (follow_up_id) REFERENCES follow_ups(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Adicionar foreign key para restaurants se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'visits_restaurant_id_fkey'
    ) THEN
        ALTER TABLE visits 
        ADD CONSTRAINT visits_restaurant_id_fkey 
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Adicionar foreign key para sellers se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'visits_seller_id_fkey'
    ) THEN
        ALTER TABLE visits 
        ADD CONSTRAINT visits_seller_id_fkey 
        FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_visits_updated_at ON visits;
CREATE TRIGGER trigger_update_visits_updated_at
    BEFORE UPDATE ON visits
    FOR EACH ROW
    EXECUTE FUNCTION update_visits_updated_at();

-- RLS Policies
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations" ON visits;
CREATE POLICY "Allow all operations" ON visits FOR ALL USING (true);

