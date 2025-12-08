# 🚀 CRM Ymbale

Sistema de CRM para gestão de prospecção de restaurantes com funcionalidades avançadas de mapeamento, rotas inteligentes e análise de dados.

## ✨ Funcionalidades

- 📊 **Dashboard** - Visão geral de métricas e KPIs
- 👥 **Gestão de Clientes** - Cadastro e acompanhamento de restaurantes
- 🗺️ **Mapa Inteligente** - Visualização geográfica com rotas otimizadas
- 📅 **Agenda Semanal** - Planejamento de visitas com drag & drop
- 🧠 **Otimização de Rotas** - Reorganização automática baseada em distâncias
- 📈 **Relatórios** - Análises e exportação de dados
- 🎨 **White Label** - Personalização de cores e logo
- 👤 **Multi-usuários** - Gestão de vendedores e permissões

## 🛠️ Tecnologias

- **Frontend:** Next.js 16, React 19, TypeScript
- **Backend:** Next.js API Routes, Server Actions
- **Banco de Dados:** PostgreSQL + Prisma ORM
- **Mapas:** Google Maps API
- **Storage:** Supabase (opcional)
- **IA:** OpenAI / Google AI (opcional)

## 📋 Pré-requisitos

- Node.js 20+
- PostgreSQL 14+
- NPM ou Yarn

## 🚀 Instalação Local

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/crm-ymbale.git
cd crm-ymbale
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar com suas configurações
nano .env
```

### 4. Configurar banco de dados
```bash
# Gerar Prisma Client
npx prisma generate

# Aplicar schema no banco
npx prisma db push
```

### 5. Criar usuário admin (opcional)
```bash
npx tsx scripts/create-admin.ts
```

### 6. Iniciar servidor de desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:3000

## 🌐 Deploy em Produção (Ubuntu 22.04)

### Instalação Rápida
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Clonar projeto
cd /var/www
git clone https://github.com/seu-usuario/crm-ymbale.git
cd crm-ymbale

# Instalar e buildar
npm install
cp env.example .env
nano .env  # Configurar variáveis
npx prisma generate
npx prisma db push
npm run build

# Iniciar com PM2
sudo npm install -g pm2
pm2 start npm --name "crm-ymbale" -- start
pm2 startup && pm2 save
```

### Configurar Nginx (opcional)
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/crm-ymbale
```

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/crm-ymbale /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### SSL com Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## 📁 Estrutura do Projeto

```
crm-ymbale/
├── prisma/              # Schema do banco de dados
├── public/              # Arquivos estáticos
├── scripts/             # Scripts utilitários
├── src/
│   ├── app/            # Páginas e rotas (App Router)
│   ├── components/     # Componentes React
│   ├── contexts/       # Contextos React
│   └── lib/            # Utilitários e configurações
├── env.example         # Template de variáveis de ambiente
└── package.json
```

## 🔐 Credenciais Padrão

Após executar o script de criação de admin:
- **Usuário:** admin
- **Senha:** Admin@123

⚠️ **Altere a senha após o primeiro login!**

## 📄 Licença

Este projeto é privado e de uso exclusivo.

## 🤝 Suporte

Para suporte, entre em contato com a equipe de desenvolvimento.
