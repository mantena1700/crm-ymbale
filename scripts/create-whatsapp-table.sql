-- Criar tabela para armazenar mensagens do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_restaurant ON whatsapp_messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- Comentários
COMMENT ON TABLE whatsapp_messages IS 'Armazena todas as mensagens do WhatsApp integradas ao CRM';
COMMENT ON COLUMN whatsapp_messages.restaurant_id IS 'ID do restaurante/cliente relacionado à conversa';
COMMENT ON COLUMN whatsapp_messages.direction IS 'Direção da mensagem: inbound (recebida) ou outbound (enviada)';

