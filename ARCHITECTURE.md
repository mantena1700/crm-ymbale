# 🏗️ Arquitetura do Sistema - CRM Ymbale

Este documento descreve a arquitetura técnica e o funcionamento interno do sistema.

---

## 📐 Visão Geral

O CRM Ymbale é uma aplicação Next.js 16 com App Router, utilizando PostgreSQL como banco de dados e Prisma como ORM.

### Stack Tecnológico

- **Frontend:** Next.js 16, React 19, TypeScript
- **Backend:** Next.js Server Actions, API Routes
- **Banco de Dados:** PostgreSQL 16
- **ORM:** Prisma 6
- **Estilização:** CSS Modules, CSS Variables
- **Deploy:** Node.js, PM2, Nginx

---

## 🗂️ Estrutura de Diretórios

```
crm-ymbale/
├── src/
│   ├── app/                    # App Router (páginas e rotas)
│   │   ├── admin/
│   │   │   └── zonas/          # Gerenciamento de zonas
│   │   ├── sellers/            # Gerenciamento de executivos
│   │   ├── carteira/           # Carteira de clientes
│   │   ├── clients/            # Gestão de leads/clientes
│   │   ├── pipeline/           # Pipeline de vendas
│   │   ├── agenda/             # Agenda e follow-ups
│   │   └── actions.ts          # Server actions globais
│   ├── components/             # Componentes React reutilizáveis
│   │   ├── Sidebar.tsx         # Menu lateral
│   │   ├── PageLayout.tsx      # Layout de páginas
│   │   └── ...
│   ├── lib/                    # Bibliotecas e utilitários
│   │   ├── db.ts               # Cliente Prisma
│   │   ├── db-data.ts          # Funções de acesso a dados
│   │   └── ...
│   └── types/                  # Definições TypeScript
├── prisma/
│   └── schema.prisma           # Schema do banco de dados
├── public/                     # Arquivos estáticos
└── scripts/                    # Scripts utilitários
```

---

## 🗄️ Modelo de Dados

### Entidades Principais

#### 1. Users (Usuários)
- Autenticação e autorização
- Roles e permissões

#### 2. Sellers (Executivos)
- Dados do executivo
- Relacionamento com zonas (seller_zonas)
- Relacionamento com restaurantes

#### 3. Restaurants (Restaurantes/Clientes)
- Dados do restaurante
- Endereço (JSON)
- Zona atribuída (zona_id)
- Executivo responsável (seller_id)

#### 4. ZonaCep (Zonas de Atendimento)
- Nome da zona
- Range de CEP (inicial e final)
- Status ativo/inativo

#### 5. SellerZona (Relacionamento Executivo-Zona)
- Relacionamento many-to-many
- Um executivo pode ter múltiplas zonas
- Uma zona pode ter múltiplos executivos

### Diagrama de Relacionamentos

```
Users
  └── (autenticação)

Sellers (Executivos)
  ├── seller_zonas ──┐
  │                   ├──> ZonaCep
  └── restaurants <───┘
                      │
                      └──> Restaurants
                            └── zona_id ──> ZonaCep
```

---

## 🔄 Fluxo de Dados

### 1. Criação de Zona

```
Cliente (Browser)
  └──> POST /admin/zonas (Server Action)
        └──> createZona()
              ├──> Validação de CEP
              ├──> Verificação de sobreposição
              └──> INSERT INTO zonas_cep
                    └──> Retorna zona criada
```

### 2. Atribuição de Zona ao Executivo

```
Cliente (Browser)
  └──> POST /sellers (Server Action)
        └──> createSeller() ou updateSeller()
              ├──> INSERT INTO sellers
              ├──> INSERT INTO seller_zonas (múltiplas)
              └──> assignRestaurantsToSellerByZones()
                    ├──> SELECT restaurantes WHERE zona_id IN (...)
                    └──> UPDATE restaurants SET seller_id = ...
```

### 3. Importação de Restaurantes

```
Cliente (Browser)
  └──> POST /actions (Server Action)
        └──> importExcelFile()
              ├──> Parse Excel
              ├──> Para cada restaurante:
              │     ├──> Extrair CEP do endereço
              │     ├──> findZonaByCep()
              │     ├──> Atribuir zona_id
              │     └──> findSellerByZona()
              │           └──> Atribuir seller_id
              └──> INSERT INTO restaurants
```

### 4. Alocação de Restaurantes

```
Cliente (Browser)
  └──> POST /actions (Server Action)
        └──> allocateRestaurantsToZones()
              ├──> SELECT todos restaurantes
              ├──> Para cada restaurante:
              │     ├──> Extrair CEP
              │     ├──> findZonaByCep()
              │     └──> UPDATE zona_id
              └──> syncRestaurantsWithSellers()
                    └──> Atribuir seller_id baseado na zona
```

---

## 🛡️ Defensive Programming

O sistema implementa várias camadas de segurança e robustez:

### 1. Verificação de Tabelas

```typescript
async function ensureTableExists() {
    try {
        await prisma.$queryRaw`SELECT 1 FROM tabela LIMIT 1`;
    } catch (error) {
        if (error.code === '42P01') {
            // Criar tabela automaticamente
            await prisma.$executeRaw`CREATE TABLE ...`;
        }
    }
}
```

### 2. Fallback para SQL Direto

Quando o Prisma Client não está disponível, o sistema usa SQL direto:

```typescript
if (prisma && typeof (prisma as any).sellerZona !== 'undefined') {
    // Usar Prisma Client
    await prisma.sellerZona.create(...);
} else {
    // Fallback: SQL direto
    await prisma.$executeRaw`INSERT INTO seller_zonas ...`;
}
```

### 3. Cast Explícito de Tipos

Todas as queries SQL fazem cast explícito para UUID:

```typescript
await prisma.$executeRaw`
    INSERT INTO seller_zonas (seller_id, zona_id)
    VALUES (${sellerId}::uuid, ${zonaId}::uuid)
`;
```

---

## 🎨 Design System

### CSS Variables

Definidas em `src/app/globals.css`:

```css
:root {
    --primary: #6366f1;
    --secondary: #1e293b;
    --accent: #8b5cf6;
    --foreground: #ffffff;
    --background: #0f172a;
    --border: #334155;
    --text-muted: #94a3b8;
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    /* ... */
}
```

### Componentes Reutilizáveis

- `PageLayout` - Layout padrão de páginas
- `Sidebar` - Menu lateral
- `Modal` - Modais reutilizáveis
- `Button` - Botões estilizados
- `Table` - Tabelas consistentes

---

## 🔐 Segurança

### Autenticação

- Cookies HTTP-only para sessão
- Middleware de autenticação
- Verificação de roles e permissões

### Validação

- Validação de CEP (formato e range)
- Validação de sobreposição de zonas
- Sanitização de inputs
- Proteção contra SQL Injection (Prisma)

### Autorização

- Verificação de permissões por rota
- Controle de acesso baseado em roles
- Proteção de Server Actions

---

## 📊 Performance

### Otimizações

1. **Server Components:** Máximo de componentes no servidor
2. **Lazy Loading:** Componentes pesados carregados sob demanda
3. **Índices no Banco:** Índices em colunas frequentemente consultadas
4. **Cache:** `revalidatePath` para invalidar cache quando necessário
5. **Queries Eficientes:** Uso de `SELECT` específicos ao invés de `SELECT *`

### Índices Criados

```sql
-- Zonas
CREATE INDEX idx_zonas_cep_ativo ON zonas_cep(ativo);
CREATE INDEX idx_zonas_cep_range ON zonas_cep(cep_inicial, cep_final);

-- Seller-Zonas
CREATE INDEX idx_seller_zonas_seller_id ON seller_zonas(seller_id);
CREATE INDEX idx_seller_zonas_zona_id ON seller_zonas(zona_id);

-- Restaurants
CREATE INDEX idx_restaurants_zona_id ON restaurants(zona_id);
CREATE INDEX idx_restaurants_seller_id ON restaurants(seller_id);
```

---

## 🧪 Testes e Qualidade

### Validações Implementadas

- ✅ Validação de formato de CEP
- ✅ Verificação de sobreposição de ranges
- ✅ Validação de tipos (UUID, strings, etc.)
- ✅ Tratamento de erros robusto
- ✅ Logs detalhados para debugging

### Próximos Passos

- [ ] Testes unitários (Jest)
- [ ] Testes de integração
- [ ] Testes E2E (Playwright)
- [ ] CI/CD pipeline

---

## 📈 Escalabilidade

### Considerações

1. **Banco de Dados:**
   - Índices otimizados
   - Queries eficientes
   - Possibilidade de sharding por zona

2. **Aplicação:**
   - Server Components reduzem carga no cliente
   - Lazy loading de componentes pesados
   - Cache estratégico

3. **Infraestrutura:**
   - PM2 para gerenciamento de processos
   - Nginx como reverse proxy
   - Possibilidade de load balancing

---

## 🔄 Versionamento

### Estratégia

- **Semantic Versioning:** MAJOR.MINOR.PATCH
- **Changelog:** Documentado em CHANGELOG.md
- **Git Tags:** Tags para releases importantes

### Versões

- **v1.0.0:** Versão inicial
- **v2.0.0:** Sistema de Zonas de Atendimento

---

## 📚 Documentação Adicional

- [README.md](./README.md) - Visão geral e instalação
- [CHANGELOG.md](./CHANGELOG.md) - Histórico de mudanças
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guia de deploy
- [DEPLOY_VPS.md](./DEPLOY_VPS.md) - Instalação inicial na VPS

---

**Última atualização:** Dezembro 2025
