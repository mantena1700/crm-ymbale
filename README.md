# 📦 CRM Ymbale

Sistema de Gestão de Relacionamento com Clientes (CRM) desenvolvido com Next.js, PostgreSQL e Prisma.

## 🚀 Instalação Rápida com Docker

### Pré-requisitos
- Docker e Docker Compose instalados
- Git instalado

### 1. Clonar o repositório
```bash
git clone https://github.com/SEU_USUARIO/crm-ymbale.git
cd crm-ymbale
```

### 2. Criar arquivo .env
```bash
cp env.example .env
```

### 3. Subir os containers
```bash
docker-compose up -d --build
```

### 4. Criar as tabelas do banco
```bash
docker-compose exec crm prisma db push
```

### 5. Criar usuário administrador
```bash
docker-compose exec crm tsx scripts/create-admin.ts
```

### 6. Acessar o sistema
- **URL:** http://localhost:3001
- **Usuário:** admin
- **Senha:** admin

---

## 🖥️ Deploy em VPS (Produção)

Consulte o arquivo [DEPLOY_VPS.md](./DEPLOY_VPS.md) para instruções detalhadas de deploy em servidores VPS.

---

## 📋 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `docker-compose up -d` | Iniciar containers |
| `docker-compose down` | Parar containers |
| `docker-compose logs -f` | Ver logs em tempo real |
| `docker-compose exec crm sh` | Acessar terminal do container |
| `docker-compose down -v` | Parar e remover volumes (⚠️ apaga dados) |

---

## 🔧 Tecnologias

- **Frontend:** Next.js 16, React 19, TypeScript
- **Backend:** Next.js API Routes, Server Actions
- **Banco de Dados:** PostgreSQL 16
- **ORM:** Prisma 6
- **Autenticação:** Sistema próprio com bcrypt
- **Deploy:** Docker, Docker Compose

---

## 📁 Estrutura do Projeto

```
crm-ymbale/
├── src/
│   ├── app/           # Páginas e rotas (App Router)
│   ├── components/    # Componentes React
│   └── lib/           # Utilitários e configurações
├── prisma/
│   └── schema.prisma  # Schema do banco de dados
├── scripts/           # Scripts de manutenção
├── public/            # Arquivos estáticos
├── Dockerfile         # Configuração Docker
└── docker-compose.yml # Orquestração de containers
```

---

## 🔐 Variáveis de Ambiente

Copie `env.example` para `.env` e configure:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão PostgreSQL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | (Opcional) Chave Google Maps |
| `OPENAI_API_KEY` | (Opcional) Chave OpenAI para IA |
| `GOOGLE_AI_API_KEY` | (Opcional) Chave Google AI/Gemini |

---

## 📄 Licença

Projeto privado - Todos os direitos reservados.
