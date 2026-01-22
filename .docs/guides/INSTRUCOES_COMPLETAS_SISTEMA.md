# 📋 INSTRUÇÕES COMPLETAS PARA RECRIAÇÃO DO CRM YMBALE

Este documento contém instruções detalhadas para recriar o sistema CRM Ymbale do zero. Todas as funcionalidades, lógicas de negócio, relacionamentos de dados e fluxos estão documentados aqui.

---

## 📐 VISÃO GERAL DO SISTEMA

### Stack Tecnológico
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Next.js Server Actions, API Routes
- **Banco de Dados:** PostgreSQL 16
- **ORM:** Prisma 6
- **Estilização:** CSS Modules, CSS Variables
- **Autenticação:** Sistema customizado com bcrypt e sessões
- **Integrações:** Google Maps API, OpenAI API, Google AI API

### Arquitetura
- **Padrão:** Server Components (máximo possível) + Client Components (quando necessário)
- **Roteamento:** App Router do Next.js 16
- **Estado:** Server State (via Server Actions) + Client State (React hooks)
- **Cache:** `revalidatePath` do Next.js para invalidar cache quando necessário

---

## 🗄️ MÓDULO 1: BANCO DE DADOS E MODELO DE DADOS

### 1.1. Schema Principal (Prisma)

O sistema possui as seguintes entidades principais:

#### **Users (Usuários)**
```prisma
model User {
  id                 String    @id @default(uuid())
  username           String    @unique
  email              String?   @unique
  password           String    // Hash bcrypt
  name               String
  role               String    @default("user") // 'admin' ou 'user'
  active             Boolean   @default(true)
  mustChangePassword Boolean   @default(false)
  lastLogin          DateTime?
  loginAttempts      Int       @default(0)
  lockedUntil        DateTime?
  sellerId            String?   @unique // Relação opcional com Seller
  seller              Seller?   @relation(...)
  sessions           Session[]
  userPermissions    UserPermission[]
}
```

**Lógica:**
- Senha deve ser hash com bcrypt (10 rounds)
- `loginAttempts` incrementa a cada tentativa falha
- Após 5 tentativas, bloquear por 30 minutos (`lockedUntil`)
- `mustChangePassword` força troca de senha no primeiro acesso
- Relação 1:1 opcional com Seller (um usuário pode ser um executivo)

#### **Sellers (Executivos/Vendedores)**
```prisma
model Seller {
  id                String    @id @default(uuid())
  name              String
  email             String?
  phone             String?
  photoUrl          String?
  active            Boolean   @default(true)
  
  // Território Geográfico
  territorioTipo    String?   @default("cep_legado") // 'raio', 'poligono', 'cep_legado'
  baseCidade        String?
  baseLatitude      Decimal?
  baseLongitude     Decimal?
  raioKm            Int?
  poligonoPontos    Json?     // Array de pontos [{lat, lng}]
  territorioAtivo   Boolean   @default(true)
  areasCobertura    Json?     // Array: [{cidade, latitude, longitude, raioKm}]
  
  restaurants       Restaurant[]
  visits            Visit[]
  fixedClients      FixedClient[]
  user              User?
}
```

**Lógica de Território:**
- **Tipo 'raio':** Cobertura circular a partir de uma coordenada base
- **Tipo 'poligono':** Cobertura por área poligonal (algoritmo Ray Casting)
- **areasCobertura:** Múltiplas áreas de cobertura (array JSON)
- Um executivo pode ter múltiplas áreas de cobertura

#### **Restaurants (Restaurantes/Clientes)**
```prisma
model Restaurant {
  id                  String    @id @default(uuid())
  name                String
  codigoCliente       Int?      @unique // Código único (começa em 10000)
  rating              Decimal?  @default(0)
  reviewCount         Int?      @default(0)
  totalComments       Int?      @default(0)
  projectedDeliveries Int?      @default(0)
  salesPotential      String?   @default("N/A") // 'ALTÍSSIMO', 'ALTO', 'MÉDIO', 'BAIXO'
  address             Json?     // {street, neighborhood, city, state, zip}
  status              String?   @default("A Analisar") // Pipeline stages
  sellerId            String?
  assignedAt          DateTime?
  latitude            Float?
  longitude           Float?
  geocodingData       Json?     // Cache de dados do Google Maps
  geocodingAtualizadoEm DateTime?
  
  seller              Seller?
  comments            Comment[]
  analyses            Analysis[]
  notes               Note[]
  followUps           FollowUp[]
  visits              Visit[]
}
```

**Lógica:**
- `codigoCliente` é gerado automaticamente (sequencial, começando em 10000)
- `address` é JSON com estrutura padronizada
- `status` segue pipeline: "A Analisar" → "Qualificado" → "Contatado" → "Negociação" → "Fechado"
- Coordenadas são cacheadas para evitar múltiplas chamadas à API

#### **ZonaCep (Zonas de Atendimento - Sistema Legado)**
```prisma
model ZonaCep {
  id          String   @id @default(uuid())
  zonaNome    String
  cepInicial  String   // Formato: "12345-678"
  cepFinal    String
  ativo       Boolean  @default(true)
}
```

**Lógica:**
- Sistema legado baseado em ranges de CEP
- Usado como fallback quando atribuição geográfica falha
- Validação: CEP inicial <= CEP final
- Não permite sobreposição de ranges

#### **Outras Entidades Importantes:**
- **FollowUp:** Agendamentos e follow-ups
- **Analysis:** Análises de IA dos restaurantes
- **Note:** Notas dos restaurantes
- **Visit:** Visitas realizadas pelos executivos
- **Campaign:** Campanhas de marketing
- **Workflow:** Automações e workflows
- **FixedClient:** Clientes fixos com recorrência

### 1.2. Relacionamentos Principais

```
User ←→ Seller (1:1 opcional)
Seller → Restaurant (1:N)
Restaurant → Analysis (1:N)
Restaurant → FollowUp (1:N)
Restaurant → Note (1:N)
Restaurant → Visit (1:N)
Seller → Visit (1:N)
Campaign → CampaignRecipient → Restaurant (N:N)
Workflow → WorkflowExecution → Restaurant (1:N)
Seller → FixedClient (1:N)
```

### 1.3. Índices Importantes

```sql
-- Performance
CREATE INDEX idx_restaurants_seller_id ON restaurants(seller_id);
CREATE INDEX idx_restaurants_status ON restaurants(status);
CREATE INDEX idx_restaurants_coords ON restaurants(latitude, longitude);
CREATE INDEX idx_follow_ups_scheduled_date ON follow_ups(scheduled_date);
CREATE INDEX idx_visits_seller_id ON visits(seller_id);
```

---

## 🔐 MÓDULO 2: AUTENTICAÇÃO E SEGURANÇA

### 2.1. Fluxo de Autenticação

**1. Login (`/api/auth/login`)**
```
Cliente → POST /api/auth/login {username, password}
  ↓
Servidor → authenticateUser(username, password)
  ↓
  ├─ Verificar se usuário existe
  ├─ Verificar se está ativo
  ├─ Verificar se está bloqueado (lockedUntil)
  ├─ Verificar senha (bcrypt.compare)
  ├─ Se falhar: incrementar loginAttempts
  │   └─ Se >= 5: definir lockedUntil (30 min)
  └─ Se sucesso:
      ├─ Resetar loginAttempts
      ├─ Atualizar lastLogin
      └─ Criar sessão (createSession)
          └─ Retornar token + definir cookie httpOnly
```

**2. Verificação de Sessão (`/api/auth/session`)**
```
Cliente → GET /api/auth/session
  ↓
Servidor → Verificar cookie 'session_token'
  ↓
  ├─ Buscar sessão no banco
  ├─ Verificar se não expirou (expiresAt)
  └─ Retornar dados do usuário
```

**3. Middleware de Proteção (`src/middleware.ts`)**
```typescript
// Protege rotas que não são públicas
const publicRoutes = ['/login', '/api/auth/login'];
if (!publicRoutes.includes(pathname)) {
  // Verificar sessão
  // Se não autenticado → redirecionar para /login
}
```

### 2.2. Sistema de Permissões

**Estrutura:**
- Permissões granulares por módulo e ação
- Código: `{modulo}.{acao}` (ex: "dashboard.view", "clients.create")
- Usuários podem ter permissões específicas além do role

**Verificação:**
```typescript
// Verificar se usuário tem permissão
async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  // 1. Verificar role (admin tem todas)
  // 2. Verificar permissões específicas do usuário
}
```

### 2.3. Proteção de Rotas

- **Server Components:** Verificar autenticação no servidor antes de renderizar
- **API Routes:** Verificar token na requisição
- **Client Components:** Usar `useAuth()` hook para verificar estado

---

## 📥 MÓDULO 3: IMPORTAÇÃO DE DADOS

### 3.1. Fluxo de Importação Excel

**Action:** `importExcelFile(formData: FormData)`

**Processo:**
```
1. Receber arquivo(s) Excel via FormData
2. Parsear Excel usando biblioteca 'xlsx'
3. Para cada linha da planilha:
   a. Extrair dados com função helper (getColumnValue)
      - Suporta múltiplas variações de nomes de colunas
      - Busca case-insensitive
      - Normaliza espaços
   
   b. Extrair comentários:
      - Buscar colunas que contenham "coment" no nome
      - Adicionar ao array de comentários
   
   c. Verificar duplicatas:
      - Buscar por nome + cidade
      - Se existir → pular (skipped++)
   
   d. Normalizar CEP:
      - Remover caracteres especiais
      - Validar formato
      - Se inválido → tentar extrair de endereço completo
   
   e. Gerar código de cliente:
      - Buscar maior código existente
      - Incrementar (ou começar em 10000)
   
   f. Atribuir zona (sistema legado):
      - findZonaByCep(cep)
      - Se encontrar → atribuir zonaId
   
   g. Atribuir executivo:
      - Se tem zonaId → findSellerByZona(zonaId)
      - OU usar atribuição geográfica (atribuirExecutivoAutomatico)
   
   h. Criar restaurante no banco:
      - INSERT com todos os dados
      - Criar comentários relacionados
      - Atualizar contadores (imported++)
   
4. Retornar resumo:
   - Total importados
   - Total ignorados (duplicados)
   - Total erros
```

### 3.2. Função Helper de Extração

```typescript
function getColumnValue(row: any, possibleNames: string[]): any {
  // 1. Tentar busca exata
  // 2. Tentar busca case-insensitive
  // 3. Tentar busca parcial (includes)
  // 4. Retornar null se não encontrar
}
```

**Colunas Suportadas:**
- Nome: ['Nome', 'nome', 'Restaurante']
- Cidade: ['Cidade', 'city', 'CIDADE']
- CEP: ['CEP', 'Zip Code', 'Código Postal']
- Avaliação: ['Avaliação', 'Rating', 'rating']
- E outras...

### 3.3. Atribuição Automática na Importação

**Opção 1: Por Zona (Legado)**
```typescript
// Buscar zona pelo CEP
const zona = await findZonaByCep(cep);
if (zona) {
  // Buscar executivo responsável pela zona
  const seller = await findSellerByZona(zona.id);
  if (seller) {
    sellerId = seller.id;
  }
}
```

**Opção 2: Por Atribuição Geográfica (Atual)**
```typescript
// Usar Google Maps para obter coordenadas
const atribuicao = await atribuirExecutivoAutomatico({
  address: enderecoCompleto,
  cep: cep
});

if (atribuicao.sucesso) {
  sellerId = atribuicao.executivo_id;
  // Salvar coordenadas no cache
  latitude = atribuicao.coordenadas.lat;
  longitude = atribuicao.coordenadas.lng;
}
```

### 3.4. Tratamento de Erros

- **Duplicatas:** Ignorar silenciosamente (não é erro)
- **CEP inválido:** Tentar extrair do endereço completo
- **Falha na atribuição:** Restaurante fica sem executivo (pode atribuir depois)
- **Erro de parsing:** Registrar e continuar com próxima linha

---

## 🗺️ MÓDULO 4: ATRIBUIÇÃO GEOGRÁFICA E ZONAS

### 4.1. Sistema de Atribuição Geográfica

**Função Principal:** `atribuirExecutivoAutomatico(restaurante)`

**Fluxo:**
```
1. Obter coordenadas do restaurante:
   ├─ Se tem latitude/longitude em cache → usar cache
   └─ Se não → chamar Google Geocoding API
       └─ Salvar coordenadas no banco (cache)

2. Buscar executivos com território ativo:
   └─ WHERE territorioAtivo = true
       AND (territorioTipo IN ('raio', 'poligono') OR areasCobertura IS NOT NULL)

3. Para cada executivo, verificar cobertura:
   
   a. Se tem areasCobertura (múltiplas áreas):
      └─ Para cada área:
          ├─ Calcular distância (Haversine)
          └─ Se distância <= raioKm → adicionar como candidato
   
   b. Se territorioTipo = 'raio':
      ├─ Calcular distância até baseLatitude/baseLongitude
      └─ Se distância <= raioKm → adicionar como candidato
   
   c. Se territorioTipo = 'poligono':
      ├─ Verificar se ponto está dentro do polígono (Ray Casting)
      └─ Se dentro → calcular distância até centro → adicionar candidato

4. Selecionar executivo:
   ├─ Se múltiplos candidatos → escolher o mais próximo (menor distância)
   └─ Se nenhum candidato → retornar erro (fora de cobertura)

5. Retornar resultado:
   {
     sucesso: boolean,
     executivo_id?: string,
     executivo_nome?: string,
     distancia_km?: number,
     metodo?: string, // 'raio', 'poligono', 'raio_multiplas_areas'
     coordenadas?: {lat, lng}
   }
```

### 4.2. Cálculo de Distância (Haversine)

```typescript
function calculateDistance(lat1, lng1, lat2, lng2): number {
  // Fórmula de Haversine
  // Retorna distância em km
}
```

### 4.3. Verificação de Polígono (Ray Casting)

```typescript
function pontoNoPoligono(ponto: {lat, lng}, poligono: Array<{lat, lng}>): boolean {
  // Algoritmo Ray Casting
  // Conta interseções de raio horizontal com arestas do polígono
  // Se número ímpar → ponto está dentro
}
```

### 4.4. Sistema de Zonas (Legado)

**Função:** `findZonaByCep(cep: string)`

**Lógica:**
```
1. Normalizar CEP (remover hífen)
2. Buscar zona onde:
   - cepInicial <= cep <= cepFinal
   - ativo = true
3. Retornar zona encontrada
```

**Validação ao Criar Zona:**
- Formato CEP: "12345-678"
- CEP inicial <= CEP final
- Não pode sobrepor com outras zonas ativas
- Verificar sobreposição:
  ```
  (novo_cep_inicial <= existente_cep_final) AND
  (novo_cep_final >= existente_cep_inicial)
  ```

### 4.5. Sincronização de Restaurantes

**Action:** `syncRestaurantsWithSellers()`

**Processo:**
```
1. Buscar todos os restaurantes sem executivo OU com zonaId
2. Para cada restaurante:
   a. Se tem zonaId:
      └─ Buscar executivo da zona → atribuir
   
   b. Se não tem zonaId mas tem endereço:
      └─ Tentar atribuição geográfica
   
   c. Se não tem nada:
      └─ Pular (manter sem atribuição)
3. Atualizar banco em lote
```

---

## 📊 MÓDULO 5: PIPELINE E STATUS

### 5.1. Status do Pipeline

**Estágios (ordem):**
1. **"A Analisar"** - Recém importado, aguardando análise
2. **"Qualificado"** - Analisado e considerado viável
3. **"Contatado"** - Primeiro contato realizado
4. **"Negociação"** - Em processo de negociação
5. **"Fechado"** - Negócio fechado

### 5.2. Atualização de Status

**Action:** `updateRestaurantStatus(id, newStatus)`

**Lógica:**
```
1. Atualizar status no banco
2. Criar notificação automática se:
   - newStatus === 'Fechado' → Notificação de sucesso
   - newStatus === 'Qualificado' → Notificação de lead qualificado
3. Invalidar cache das páginas relacionadas:
   - /pipeline
   - /restaurant/[id]
   - /clients
```

### 5.3. Visualização Kanban

**Componente:** `PipelineClient`

**Funcionalidades:**
- **Drag & Drop:** Arrastar cards entre colunas (muda status)
- **Filtros:**
  - Por executivo
  - Por potencial de vendas
  - Por busca textual
- **Métricas por coluna:**
  - Total de restaurantes
  - Valor estimado (se houver)
  - Tempo médio no estágio
- **Quick View:** Modal rápido ao clicar no card
  - Ver detalhes básicos
  - Mudar status
  - Mudar prioridade
  - Criar follow-up rápido

### 5.4. Priorização Automática

**Cálculo de Prioridade:**
```typescript
let priority: 'urgent' | 'high' | 'medium' | 'low' = 'low';

if (salesPotential === 'ALTÍSSIMO' || analysisScore >= 70) {
  priority = 'urgent';
} else if (salesPotential === 'ALTO' || analysisScore >= 50) {
  priority = 'high';
} else if (salesPotential === 'MÉDIO' || analysisScore >= 30) {
  priority = 'medium';
}
```

### 5.5. Próxima Ação Sugerida

**Lógica:**
```typescript
if (status === 'A Analisar') nextAction = 'Analisar com IA';
else if (status === 'Qualificado') nextAction = 'Primeiro contato';
else if (status === 'Contatado') nextAction = 'Agendar apresentação';
else if (status === 'Negociação') nextAction = 'Enviar proposta';
else if (status === 'Fechado') nextAction = 'Pós-venda';
```

---

## 👥 MÓDULO 6: CARTEIRA E EXECUTIVOS

### 6.1. Estrutura da Página de Carteira

**Abas Principais:**
1. **Carteira Padrão:** Visão consolidada de todos os executivos
2. **Carteira Individual:** Filtrada por executivo selecionado
3. **Semana:** Planejamento semanal de visitas
4. **Agenda:** Calendário de follow-ups
5. **Mapa:** Visualização geográfica
6. **Exportar Checkmob:** Exportação para sistema externo
7. **Exportar Agendamento:** Exportação para template Excel
8. **Clientes Fixos:** Gestão de clientes com recorrência

### 6.2. Carteira Padrão

**Funcionalidades:**
- Lista todos os executivos
- Para cada executivo, mostra:
  - Avatar e informações básicas
  - Estatísticas:
    - Total de clientes
    - Por status (Qualificado, Contatado, etc.)
    - Por potencial (ALTÍSSIMO, ALTO, etc.)
  - Cards dos restaurantes atribuídos
- Filtros globais:
  - Por status
  - Por potencial
  - Por período (últimos 7/30/90 dias)
  - Por busca textual

### 6.3. Visualização de Cards

**Cada card mostra:**
- Nome do restaurante
- Cidade e bairro
- Status (badge colorido)
- Potencial de vendas (badge)
- Rating e número de avaliações
- Ações rápidas:
  - Ver detalhes
  - Agendar visita
  - Mudar status
  - Mudar prioridade
  - Adicionar nota

### 6.4. Planejamento Semanal

**Funcionalidades:**
- Calendário semanal (segunda a sexta)
- Slots de horário (manhã, tarde, noite)
- Arrastar restaurantes para slots
- Preenchimento automático inteligente:
  - Analisa histórico de visitas
  - Sugere melhor horário/dia
  - Considera distâncias
- Exportação para Excel (template específico)

### 6.5. Mapa Tecnológico

**Funcionalidades:**
- Mapa interativo (Google Maps ou Leaflet)
- Marcadores por restaurante
- Agrupamento por zoom (clusters)
- Filtros:
  - Por executivo
  - Por status
  - Por potencial
- Cores diferentes por status/potencial
- Ao clicar no marcador:
  - Ver informações do restaurante
  - Ver rota até o local
  - Agendar visita

### 6.6. Clientes Fixos (Fixed Clients)

**Conceito:**
- Clientes que devem ser visitados com recorrência
- Pode ser restaurante da base OU cadastrado manualmente
- Configuração de recorrência:
  - **Mensal:** Dias específicos do mês (ex: [2, 14])
  - **Semanal:** Dias da semana (ex: [1, 4] = segunda e quinta)

**Estrutura:**
```typescript
{
  sellerId: string,
  restaurantId?: string, // Opcional (se for da base)
  clientName?: string,   // Se cadastrado manualmente
  clientAddress?: Json,
  recurrenceType: 'monthly_days' | 'weekly_days',
  monthlyDays: number[], // [2, 14]
  weeklyDays: number[],  // [1, 4] (0=domingo)
  radiusKm: number,      // Raio de proximidade
  latitude?: number,
  longitude?: number
}
```

**Lógica de Sugestão:**
- Sistema sugere restaurantes próximos ao cliente fixo
- Considera raio de proximidade
- Pode agrupar visitas próximas no mesmo dia

---

## 📈 MÓDULO 7: DASHBOARD E RELATÓRIOS

### 7.1. Dashboard Principal

**Métricas Principais:**
- Total de restaurantes
- Leads qualificados
- Leads contatados
- Em negociação
- Negócios fechados
- Pendentes de análise
- Leads quentes (ALTÍSSIMO)
- Rating médio

**Gráficos:**
- Distribuição por status (pie chart)
- Distribuição por potencial (bar chart)
- Distribuição por região/cidade (bar chart)
- Evolução temporal (line chart)

**Widgets:**
- Top 10 leads quentes
- Próximos follow-ups (5)
- Metas do período
- Atividades recentes
- Notificações pendentes

### 7.2. Relatórios

**Tipos de Relatório:**
1. **Por Executivo:**
   - Total de clientes
   - Por status
   - Taxa de conversão
   - Tempo médio no pipeline
   
2. **Por Período:**
   - Novos leads
   - Conversões
   - Follow-ups realizados
   - Visitas realizadas

3. **Por Região:**
   - Distribuição geográfica
   - Densidade de leads
   - Potencial por região

4. **Performance:**
   - Taxa de conversão geral
   - Tempo médio por estágio
   - Leads quentes vs frios

**Exportação:**
- Excel (.xlsx)
- PDF (futuro)
- CSV

---

## 📧 MÓDULO 8: CAMPANHAS E WORKFLOWS

### 8.1. Sistema de Campanhas

**Estrutura:**
```typescript
{
  name: string,
  type: 'email' | 'sms' | 'linkedin',
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed',
  segmentCriteria: {
    status?: string[],
    salesPotential?: string[],
    sellerId?: string,
    region?: string
  },
  subject?: string,
  content?: string,
  scheduledAt?: DateTime,
  totalRecipients: number,
  sentCount: number,
  deliveredCount: number,
  openedCount: number,
  clickedCount: number
}
```

**Fluxo:**
```
1. Criar campanha (draft)
2. Definir segmentação (critérios)
3. Selecionar destinatários (ou usar segmentação automática)
4. Criar conteúdo (ou usar template)
5. Agendar envio (ou enviar imediatamente)
6. Executar campanha:
   - Para cada destinatário:
     - Enviar email/sms
     - Registrar status
     - Atualizar métricas
7. Acompanhar resultados
```

### 8.2. Templates de Email

**Estrutura:**
```typescript
{
  name: string,
  subject: string,
  content: string, // HTML com variáveis {{nome}}, {{cidade}}, etc.
  variables: string[], // ['nome', 'cidade', 'rating']
  category: 'prospecting' | 'follow_up' | 're_engagement' | 'custom'
}
```

**Substituição de Variáveis:**
```typescript
// Substituir {{variavel}} pelo valor real
function replaceVariables(template: string, data: any): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
}
```

### 8.3. Workflows (Automações)

**Estrutura:**
```typescript
{
  name: string,
  triggerType: 'status_change' | 'new_lead' | 'no_contact_days' | 'rating_threshold' | 'manual',
  triggerConditions: {
    status?: string,
    days?: number,
    rating?: number
  },
  steps: [
    {
      type: 'send_email' | 'create_followup' | 'update_status' | 'assign_seller' | 'create_note',
      delay: number, // dias
      config: any
    }
  ],
  active: boolean
}
```

**Exemplo de Workflow:**
```
Trigger: Novo lead qualificado (status = 'Qualificado')
Steps:
  1. Enviar email de boas-vindas (delay: 0 dias)
  2. Criar follow-up para contato (delay: 3 dias)
  3. Se não responder em 7 dias → atualizar status para 'Contatado'
```

**Execução:**
```typescript
async function executeWorkflow(workflowId: string, restaurantId: string) {
  // 1. Buscar workflow
  // 2. Verificar condições do trigger
  // 3. Para cada step:
  //    - Aguardar delay (se houver)
  //    - Executar ação
  //    - Registrar no log
  // 4. Atualizar status da execução
}
```

---

## 🤖 MÓDULO 9: ANÁLISE COM IA

### 9.1. Análise de Restaurante

**Função:** `analyzeRestaurant(restaurant)`

**Processo:**
```
1. Preparar dados do restaurante:
   - Nome, endereço, cidade
   - Rating, número de avaliações
   - Comentários (últimos)
   - Potencial de vendas
   - Status atual

2. Chamar serviço de IA (OpenAI ou Google AI):
   - Prompt system: "Você é um analista de vendas..."
   - Prompt user: Dados do restaurante formatados
   - Model: gpt-4o-mini ou gemini-pro
   - Temperature: 0.7

3. Processar resposta:
   - Extrair score (0-100)
   - Extrair resumo
   - Extrair pain points (pontos de dor)
   - Extrair sales copy (texto de vendas)
   - Extrair estratégia

4. Salvar análise no banco:
   - Criar registro em Analysis
   - Relacionar com restaurante

5. Atualizar status se necessário:
   - Se score >= 70 → sugerir status 'Qualificado'
```

### 9.2. Análise em Lote

**Action:** `analyzeBatch(restaurants[])`

**Processo:**
```
1. Para cada restaurante:
   - Verificar se já tem análise recente
   - Se não → chamar analyzeRestaurant
   - Aguardar delay (rate limiting)
2. Retornar resumo:
   - Total analisados
   - Total erros
   - Tempo decorrido
```

**Rate Limiting:**
- OpenAI: ~60 requests/minuto
- Google AI: ~60 requests/minuto
- Implementar delay entre requisições

### 9.3. Geração de Conteúdo com IA

**Funções:**
- `generateEmailWithAI(restaurantId, customInstructions)`
- `generateStrategyWithAI(restaurantId)`
- `generateFollowUpMessageWithAI(restaurantId, previousContact)`

**Processo Similar:**
```
1. Buscar dados do restaurante + análise
2. Preparar prompt específico
3. Chamar API de IA
4. Retornar conteúdo gerado
```

---

## 📅 MÓDULO 10: AGENDA E FOLLOW-UPS

### 10.1. Sistema de Follow-ups

**Estrutura:**
```typescript
{
  id: string,
  restaurantId: string,
  type: 'email' | 'call' | 'meeting',
  scheduledDate: DateTime,
  completed: boolean,
  completedDate?: DateTime,
  notes?: string,
  emailSubject?: string,
  emailBody?: string,
  emailSent: boolean
}
```

### 10.2. Criação de Follow-up

**Action:** `createFollowUp(restaurantId, type, scheduledDate, emailSubject?, emailBody?)`

**Lógica:**
- Criar registro no banco
- Se tipo = 'email' → preparar email (pode usar template)
- Invalidar cache da agenda

### 10.3. Visualização da Agenda

**Funcionalidades:**
- Calendário mensal/semanal
- Lista de follow-ups pendentes
- Filtros:
  - Por tipo
  - Por executivo
  - Por período
- Ações:
  - Marcar como completo
  - Editar
  - Cancelar
  - Enviar email (se tipo email)

### 10.4. Visitas

**Estrutura:**
```typescript
{
  id: string,
  restaurantId: string,
  sellerId: string,
  visitDate: DateTime,
  feedback?: string,
  outcome?: 'positive' | 'neutral' | 'negative' | 'scheduled',
  nextVisitDate?: DateTime,
  followUpId?: string // Relacionado com follow-up
}
```

**Criação:**
- Pode ser criada a partir de follow-up
- Ou criada diretamente na carteira
- Registra feedback e resultado
- Pode agendar próxima visita automaticamente

---

## 🎯 MÓDULO 11: METAS E OBJETIVOS

### 11.1. Estrutura de Metas

```typescript
{
  id: string,
  name: string,
  type: 'revenue' | 'leads' | 'conversions' | 'visits',
  target: number,
  current: number,
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  startDate: Date,
  endDate: Date,
  status: 'active' | 'completed' | 'paused' | 'cancelled'
}
```

### 11.2. Cálculo Automático

**Para cada tipo:**
- **revenue:** Soma de valores fechados (se houver)
- **leads:** Contagem de novos leads no período
- **conversions:** Contagem de status 'Fechado' no período
- **visits:** Contagem de visitas realizadas

**Atualização:**
- Pode ser manual
- Ou automática (via cron job ou trigger)

### 11.3. Visualização

- Progress bar (current / target)
- Porcentagem de conclusão
- Tempo restante
- Gráfico de evolução

---

## ⚙️ MÓDULO 12: CONFIGURAÇÕES E SISTEMA

### 12.1. Configurações do Sistema

**Tabela:** `SystemSettings`

**Campos:**
- `crmName`: Nome do CRM
- `crmLogo`: URL do logo
- `primaryColor`: Cor primária
- `secondaryColor`: Cor secundária
- `accentColor`: Cor de destaque
- `companyName`: Nome da empresa
- `companyEmail`: Email da empresa
- `companyPhone`: Telefone da empresa
- `loginTitle`: Título da página de login
- `loginSubtitle`: Subtítulo
- `loginMessage`: Mensagem personalizada
- `loginBackgroundColor`: Cor de fundo
- `loginLogo`: Logo da página de login
- `openaiApiKey`: Chave API OpenAI (criptografada)
- `googleMapsApiKey`: Chave API Google Maps
- `googleAiApiKey`: Chave API Google AI

### 12.2. Gestão de Usuários

**Funcionalidades:**
- Criar usuário
- Editar usuário
- Desativar/ativar
- Resetar senha
- Atribuir permissões
- Vincular a executivo

### 12.3. Agentes de IA

**Estrutura:**
```typescript
{
  code: string, // 'restaurant_analyzer', 'email_generator'
  name: string,
  description: string,
  systemPrompt: string,
  userPromptTemplate: string,
  model: string, // 'gpt-4o-mini', 'gemini-pro'
  temperature: number,
  maxTokens: number,
  active: boolean,
  isDefault: boolean
}
```

**Uso:**
- Cada agente tem um propósito específico
- Pode ser customizado pelo admin
- Templates de prompt podem usar variáveis

---

## 🔄 FLUXOS PRINCIPAIS DO SISTEMA

### Fluxo 1: Importação de Dados
```
Upload Excel → Parse → Validação → Atribuição Geográfica → Criação no Banco → Notificação
```

### Fluxo 2: Atribuição de Executivo
```
Restaurante sem executivo → Buscar coordenadas → Verificar territórios → Selecionar mais próximo → Atribuir
```

### Fluxo 3: Análise com IA
```
Selecionar restaurante → Chamar API IA → Processar resposta → Salvar análise → Atualizar status sugerido
```

### Fluxo 4: Pipeline de Vendas
```
A Analisar → (Análise IA) → Qualificado → (Primeiro contato) → Contatado → (Apresentação) → Negociação → (Proposta) → Fechado
```

### Fluxo 5: Campanha de Marketing
```
Criar campanha → Definir segmentação → Selecionar destinatários → Criar conteúdo → Agendar → Executar → Acompanhar resultados
```

---

## 📱 RESPONSIVIDADE E MOBILE

### Design Mobile-First
- Layout adaptativo
- Menu hambúrguer
- Cards empilhados
- Touch gestures (swipe)
- Service Worker para PWA

### Otimizações Mobile
- Lazy loading de imagens
- Componentes pesados carregados sob demanda
- Cache de dados
- Offline support (futuro)

---

## 🔒 SEGURANÇA E VALIDAÇÕES

### Validações Importantes
- CEP: Formato "12345-678"
- Email: Formato válido
- Senha: Mínimo 8 caracteres (futuro)
- UUID: Validação de formato
- SQL Injection: Prisma previne automaticamente
- XSS: Sanitização de inputs

### Proteções
- Rate limiting em APIs externas
- Validação de sessão em todas as rotas protegidas
- Criptografia de senhas (bcrypt)
- Cookies httpOnly
- CSRF protection (futuro)

---

## 🚀 DEPLOY E PRODUÇÃO

### Variáveis de Ambiente Necessárias
```
DATABASE_URL=postgresql://...
NODE_ENV=production
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
OPENAI_API_KEY=... (opcional)
GOOGLE_AI_API_KEY=... (opcional)
```

### Build
```bash
npm run build
npm start
```

### PM2 (Process Manager)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    script: 'npm',
    args: 'start',
    instances: 1,
    exec_mode: 'fork'
  }]
};
```

---

## 📝 NOTAS IMPORTANTES

1. **Cache de Coordenadas:** Sempre cachear coordenadas do Google Maps para evitar custos
2. **Rate Limiting:** Respeitar limites das APIs (OpenAI, Google Maps)
3. **Validação de Dados:** Sempre validar dados antes de salvar
4. **Tratamento de Erros:** Sempre tratar erros e retornar mensagens amigáveis
5. **Logs:** Registrar ações importantes para auditoria
6. **Performance:** Usar índices no banco, lazy loading, paginação
7. **Acessibilidade:** Sempre incluir labels, aria-labels, etc.

---

**FIM DO DOCUMENTO**

Este documento contém todas as informações necessárias para recriar o sistema CRM Ymbale. Cada módulo pode ser implementado de forma independente, seguindo a ordem sugerida ou conforme a necessidade.
