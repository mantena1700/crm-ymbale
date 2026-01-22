# 📦 MÓDULO 1: BANCO DE DADOS E MODELO DE DADOS

## Objetivo
Criar toda a estrutura do banco de dados, relacionamentos e índices necessários para o sistema.

## Passos de Implementação

### 1. Configurar Prisma

**Arquivo:** `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. Criar Modelos Principais

#### 2.1. SystemSettings
- Configurações globais do sistema
- ID fixo: "system"
- Campos de personalização (cores, logo, nome)
- Campos de API keys (criptografados)

#### 2.2. User
- Autenticação e autorização
- Relação 1:1 opcional com Seller
- Campos de segurança (loginAttempts, lockedUntil)

#### 2.3. Seller
- Executivos/Vendedores
- Campos de território geográfico
- Relações com Restaurant, Visit, FixedClient

#### 2.4. Restaurant
- Entidade principal do sistema
- Campos de endereço (JSON)
- Coordenadas geográficas (cache)
- Relações com múltiplas entidades

#### 2.5. ZonaCep (Opcional - Sistema Legado)
- Zonas baseadas em ranges de CEP
- Validação de sobreposição

#### 2.6. Outras Entidades
- Comment, Analysis, Note, FollowUp, Visit
- Campaign, CampaignRecipient, EmailTemplate
- Workflow, WorkflowExecution
- FixedClient, Goal, ActivityLog, Notification

### 3. Criar Relacionamentos

**Relacionamentos Principais:**
- User ↔ Seller (1:1 opcional)
- Seller → Restaurant (1:N)
- Restaurant → Analysis (1:N)
- Restaurant → FollowUp (1:N)
- Restaurant → Note (1:N)
- Restaurant → Visit (1:N)
- Campaign → CampaignRecipient → Restaurant (N:N)

### 4. Criar Índices

**Índices de Performance:**
```sql
-- Restaurants
CREATE INDEX idx_restaurants_seller_id ON restaurants(seller_id);
CREATE INDEX idx_restaurants_status ON restaurants(status);
CREATE INDEX idx_restaurants_coords ON restaurants(latitude, longitude);
CREATE INDEX idx_restaurants_codigo_cliente ON restaurants(codigo_cliente);

-- Follow-ups
CREATE INDEX idx_follow_ups_scheduled_date ON follow_ups(scheduled_date);
CREATE INDEX idx_follow_ups_restaurant_id ON follow_ups(restaurant_id);

-- Visits
CREATE INDEX idx_visits_seller_id ON visits(seller_id);
CREATE INDEX idx_visits_restaurant_id ON visits(restaurant_id);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);

-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 5. Migrações

**Comandos:**
```bash
npx prisma generate
npx prisma db push
# OU
npx prisma migrate dev --name init
```

### 6. Seed Inicial (Opcional)

**Criar:**
- Usuário admin padrão
- Configurações do sistema
- Zonas padrão (se usar sistema legado)

**Script:** `prisma/seed.ts`

```typescript
async function main() {
  // Criar usuário admin
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: await bcrypt.hash('admin', 10),
      name: 'Administrador',
      role: 'admin'
    }
  });

  // Criar configurações do sistema
  await prisma.systemSettings.create({
    data: {
      id: 'system',
      crmName: 'Ymbale',
      primaryColor: '#6366f1'
    }
  });
}
```

## Validações Importantes

1. **UUID:** Todos os IDs devem ser UUID v4
2. **CEP:** Formato "12345-678" (com hífen)
3. **Email:** Formato válido (validação opcional)
4. **JSON:** Campos JSON devem ter estrutura definida
5. **Datas:** Usar timestamptz para timezone

## Testes

1. Criar registros de teste
2. Verificar relacionamentos
3. Testar queries complexas
4. Verificar performance dos índices

## Próximo Módulo

Após concluir este módulo, seguir para: **MÓDULO 2: AUTENTICAÇÃO E SEGURANÇA**
