-- Adicionar modelo Campaign ao banco de dados
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'email', -- 'email', 'whatsapp', 'sms', 'linkedin'
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'
    
    -- Segmentação
    segment_criteria JSONB DEFAULT '{}', -- { status: [], potential: [], city: [], seller: [] }
    
    -- Conteúdo
    subject VARCHAR(255),
    content TEXT,
    template_id UUID,
    
    -- Agendamento
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    -- Métricas
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    opened_count INT DEFAULT 0,
    clicked_count INT DEFAULT 0,
    converted_count INT DEFAULT 0,
    
    -- Automação
    auto_follow_up BOOLEAN DEFAULT false,
    follow_up_days INT DEFAULT 7,
    
    -- Workflow
    workflow_steps JSONB DEFAULT '[]', -- [{ type: 'send_email', delay: 0 }, { type: 'create_followup', delay: 7 }]
    
    -- IA
    ai_generated BOOLEAN DEFAULT false,
    ai_prompt TEXT,
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_type ON campaigns(type);
CREATE INDEX idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);

-- Tabela de destinatários da campanha
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'bounced', 'unsubscribed'
    
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(campaign_id, restaurant_id)
);

CREATE INDEX idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_restaurant_id ON campaign_recipients(restaurant_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(status);

-- Tabela de templates de email
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- ['name', 'rating', 'city', etc]
    category VARCHAR(50), -- 'prospecting', 'follow_up', 're_engagement', 'custom'
    
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_is_default ON email_templates(is_default);

-- Tabela de workflows/automações
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- 'status_change', 'new_lead', 'no_contact_days', 'rating_threshold', 'manual'
    trigger_conditions JSONB DEFAULT '{}',
    
    steps JSONB NOT NULL DEFAULT '[]', -- [{ type: 'send_email', template_id: '...', delay: 0 }, { type: 'create_followup', delay: 7 }]
    
    active BOOLEAN DEFAULT true,
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX idx_workflows_active ON workflows(active);

-- Tabela de execuções de workflow
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'paused'
    current_step INT DEFAULT 0,
    steps_completed JSONB DEFAULT '[]',
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_restaurant_id ON workflow_executions(restaurant_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);

