# 📦 CRM Ymbale

Sistema de CRM (Customer Relationship Management) para gestão de leads e clientes.

## 🚀 Tecnologias

- **Next.js 16** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Prisma** - ORM para banco de dados
- **PostgreSQL** - Banco de dados
- **Docker** - Containerização do banco

## 📋 Funcionalidades

- ✅ Dashboard com métricas
- ✅ Gestão de leads/clientes
- ✅ Pipeline de vendas
- ✅ Agenda de follow-ups
- ✅ Gestão de vendedores
- ✅ Campanhas de marketing
- ✅ Relatórios
- ✅ Análise em lote com IA
- ✅ Sistema de metas
- ✅ Autenticação de usuários

## 🔧 Instalação Local

### 1. Clonar repositório

```bash
git clone https://github.com/mantena1700/crm-ymbale.git
cd crm-ymbale
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Iniciar PostgreSQL com Docker

```bash
docker compose up -d postgres
```

### 4. Configurar ambiente

```bash
cp env.example .env
```

### 5. Criar banco de dados

```bash
npx prisma generate
npx prisma db push
```

### 6. Criar usuário admin

```bash
npx tsx scripts/create-admin.ts
```

### 7. Iniciar em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

## 🌐 Deploy em VPS

Consulte o arquivo [DEPLOY_VPS.md](./DEPLOY_VPS.md) para instruções completas de instalação em servidor.

## 👤 Credenciais Padrão

| Campo | Valor |
|-------|-------|
| Usuário | `admin` |
| Senha | `admin` |

⚠️ **Troque a senha no primeiro acesso!**

## 📁 Estrutura do Projeto

```
crm-ymbale/
├── src/
│   ├── app/           # Páginas e rotas (App Router)
│   ├── components/    # Componentes React
│   ├── lib/           # Utilitários e configurações
│   └── types/         # Definições TypeScript
├── prisma/
│   └── schema.prisma  # Schema do banco de dados
├── scripts/           # Scripts utilitários
├── public/            # Arquivos estáticos
└── docker-compose.yml # Configuração Docker
```

## 🔑 Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão PostgreSQL |
| `NODE_ENV` | Ambiente (development/production) |
| `OPENAI_API_KEY` | (Opcional) Chave API OpenAI |
| `GOOGLE_AI_API_KEY` | (Opcional) Chave API Google AI |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | (Opcional) Chave Google Maps |

## 📊 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Iniciar em desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Iniciar produção |
| `npx prisma studio` | Interface visual do banco |
| `npx prisma db push` | Sincronizar schema |

## 📝 Licença

Projeto privado - Todos os direitos reservados.
