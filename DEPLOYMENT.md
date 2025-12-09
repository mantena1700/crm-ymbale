# 🚀 Guia de Deploy - CRM Ymbale

Este documento contém instruções detalhadas para fazer deploy e atualizar o sistema na VPS.

---

## 📋 Pré-requisitos

- ✅ VPS com acesso SSH
- ✅ Node.js 18+ instalado
- ✅ PostgreSQL 16+ instalado e rodando
- ✅ Git instalado
- ✅ PM2 ou similar para gerenciar processos
- ✅ Nginx ou similar configurado como reverse proxy

---

## 🔄 Processo de Atualização na VPS

### Passo 1: Backup do Banco de Dados

**⚠️ IMPORTANTE: Sempre faça backup antes de atualizar!**

```bash
# Conectar na VPS
ssh usuario@seu-servidor.com

# Fazer backup do banco
pg_dump -U crm_user -d crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# Ou se estiver usando Docker
docker exec crm-postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Passo 2: Atualizar Código do GitHub

```bash
# Navegar para o diretório do projeto
cd /caminho/para/crm-ymbale

# Verificar status atual
git status

# Buscar atualizações do GitHub
git fetch origin

# Verificar diferenças
git diff origin/main

# Fazer merge das atualizações
git pull origin main

# OU se preferir fazer merge manual
git merge origin/main
```

### Passo 3: Instalar Dependências

```bash
# Instalar novas dependências (se houver)
npm install

# Verificar se há atualizações de dependências
npm outdated
```

### Passo 4: Atualizar Banco de Dados

```bash
# Gerar Prisma Client
npx prisma generate

# Aplicar mudanças no schema (cria tabelas/colunas se não existirem)
npx prisma db push

# OU usar migrations (recomendado para produção)
npx prisma migrate deploy
```

**Nota:** O sistema tem funções de "defensive programming" que criam tabelas automaticamente se não existirem, mas é melhor aplicar as mudanças explicitamente.

### Passo 5: Verificar Tabelas Criadas

```bash
# Conectar ao banco
psql -U crm_user -d crm_ymbale

# Verificar se tabelas existem
\dt zonas_cep
\dt seller_zonas

# Verificar coluna zona_id em restaurants
\d restaurants

# Sair
\q
```

### Passo 6: Build da Aplicação

```bash
# Fazer build de produção
npm run build

# Verificar se build foi bem-sucedido
# (não deve ter erros)
```

### Passo 7: Reiniciar Aplicação

```bash
# Se estiver usando PM2
pm2 restart crm-ymbale

# OU
pm2 reload crm-ymbale

# Verificar status
pm2 status

# Ver logs
pm2 logs crm-ymbale
```

### Passo 8: Verificar Funcionamento

1. Acessar a aplicação no navegador
2. Fazer login
3. Verificar se `/admin/zonas` está acessível
4. Verificar se `/sellers` mostra as zonas corretamente
5. Verificar se `/carteira` exibe as zonas dos executivos

---

## 🆕 Primeira Instalação na VPS

### Passo 1: Clonar Repositório

```bash
# Clonar do GitHub
git clone https://github.com/mantena1700/crm-ymbale.git
cd crm-ymbale
```

### Passo 2: Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar .env
nano .env
```

**Variáveis necessárias:**
```env
DATABASE_URL="postgresql://crm_user:senha@localhost:5432/crm_ymbale"
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://seu-dominio.com"
```

### Passo 3: Configurar Banco de Dados

```bash
# Criar banco (se não existir)
createdb -U postgres crm_ymbale

# OU via SQL
psql -U postgres
CREATE DATABASE crm_ymbale;
CREATE USER crm_user WITH PASSWORD 'senha_segura';
GRANT ALL PRIVILEGES ON DATABASE crm_ymbale TO crm_user;
\q

# Aplicar schema
npx prisma generate
npx prisma db push

# Criar usuário admin
npx tsx scripts/create-admin.ts
```

### Passo 4: Build e Start

```bash
# Instalar dependências
npm install

# Build
npm run build

# Iniciar com PM2
pm2 start npm --name "crm-ymbale" -- start
pm2 save
pm2 startup
```

### Passo 5: Configurar Nginx

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🔧 Comandos Úteis para Manutenção

### Verificar Logs

```bash
# Logs do PM2
pm2 logs crm-ymbale

# Logs do Nginx
tail -f /var/log/nginx/error.log

# Logs do PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log
```

### Verificar Status

```bash
# Status da aplicação
pm2 status

# Status do banco
systemctl status postgresql

# Status do Nginx
systemctl status nginx
```

### Popular Zonas Iniciais

Após o deploy, acesse `/admin/zonas` e:
1. Clique em "🌱 Popular Zonas Padrão" para criar 20 zonas de SP
2. Clique em "🏙️ Adicionar Zonas Sorocaba" para criar zonas de Sorocaba

### Sincronizar Restaurantes

Após configurar zonas:
1. Acesse `/sellers`
2. Clique em "Sincronizar Restaurantes"
3. Isso atribuirá restaurantes aos executivos baseado nas zonas

---

## 🐛 Troubleshooting

### Erro: "Tabela zonas_cep não existe"

```bash
# Aplicar schema novamente
npx prisma db push

# OU criar manualmente (o sistema cria automaticamente, mas pode forçar)
psql -U crm_user -d crm_ymbale -f prisma/create-zonas-tables.sql
```

### Erro: "Prisma Client não gerado"

```bash
# Gerar Prisma Client
npx prisma generate

# Reiniciar aplicação
pm2 restart crm-ymbale
```

### Erro: "Porta 3000 já em uso"

```bash
# Verificar processo
lsof -i :3000

# Parar processo
kill -9 PID

# OU usar outra porta
PORT=3001 npm start
```

### Erro: "Falha na conexão com banco"

```bash
# Verificar se PostgreSQL está rodando
systemctl status postgresql

# Verificar conexão
psql -U crm_user -d crm_ymbale

# Verificar DATABASE_URL no .env
cat .env | grep DATABASE_URL
```

---

## 📊 Checklist de Deploy

Antes de fazer deploy, verifique:

- [ ] Backup do banco de dados feito
- [ ] Código atualizado do GitHub
- [ ] Dependências instaladas (`npm install`)
- [ ] Prisma Client gerado (`npx prisma generate`)
- [ ] Schema aplicado (`npx prisma db push`)
- [ ] Build bem-sucedido (`npm run build`)
- [ ] Variáveis de ambiente configuradas
- [ ] Aplicação reiniciada
- [ ] Testes básicos realizados
- [ ] Logs verificados (sem erros críticos)

---

## 🔐 Segurança

### Recomendações

1. **Senhas:** Use senhas fortes para banco de dados
2. **SSL:** Configure HTTPS no Nginx
3. **Firewall:** Bloqueie portas desnecessárias
4. **Backups:** Automatize backups regulares
5. **Updates:** Mantenha dependências atualizadas

### Script de Backup Automatizado

```bash
#!/bin/bash
# backup-crm.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/crm-ymbale"
mkdir -p $BACKUP_DIR

# Backup do banco
pg_dump -U crm_user crm_ymbale > $BACKUP_DIR/backup_$DATE.sql

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete

echo "Backup criado: backup_$DATE.sql"
```

Adicionar ao crontab:
```bash
0 2 * * * /caminho/para/backup-crm.sh
```

---

## 📞 Suporte

Em caso de problemas:
1. Verificar logs (`pm2 logs`)
2. Verificar status dos serviços
3. Consultar CHANGELOG.md para mudanças recentes
4. Reverter para versão anterior se necessário

---

**Última atualização:** Dezembro 2025
