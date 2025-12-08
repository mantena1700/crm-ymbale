# 🚀 Deploy do CRM Ymbale em VPS

Guia completo para instalar o sistema em um servidor VPS (Hostinger, DigitalOcean, Contabo, AWS, etc.)

---

## 📋 Requisitos da VPS

| Requisito | Mínimo | Recomendado |
|-----------|--------|-------------|
| **RAM** | 1 GB | 2 GB+ |
| **CPU** | 1 vCPU | 2 vCPU+ |
| **Disco** | 20 GB | 40 GB+ |
| **Sistema** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

---

## 🔧 PASSO 1: Conectar na VPS

### Via SSH (Terminal/PowerShell)
```bash
ssh root@SEU_IP_DA_VPS
```

### Via Painel Hostinger
1. Acesse o painel da Hostinger
2. Vá em VPS → Seu servidor → Acesso SSH
3. Use o terminal do navegador ou copie as credenciais

---

## 🔧 PASSO 2: Instalar Docker

Execute estes comandos na VPS:

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar dependências
apt install -y ca-certificates curl gnupg lsb-release git

# Adicionar repositório Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verificar instalação
docker --version
docker compose version
```

---

## 📥 PASSO 3: Clonar o Projeto do GitHub

```bash
# Ir para pasta home
cd ~

# Clonar repositório
git clone https://github.com/SEU_USUARIO/crm-ymbale.git

# Entrar na pasta
cd crm-ymbale
```

---

## 🔐 PASSO 4: Configurar Variáveis de Ambiente

### 4.1 Criar arquivo .env
```bash
nano .env
```

### 4.2 Colar este conteúdo (ALTERE A SENHA!)
```env
# Banco de Dados - USE UMA SENHA FORTE!
DATABASE_URL="postgresql://crm_user:MINHA_SENHA_SUPER_FORTE_123@postgres:5432/crm_ymbale?schema=public"

# Ambiente
NODE_ENV=production

# APIs Opcionais
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="sua-chave"
# OPENAI_API_KEY="sua-chave"
# GOOGLE_AI_API_KEY="sua-chave"
```

Salvar: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4.3 Atualizar docker-compose.yml com a MESMA senha
```bash
nano docker-compose.yml
```

Altere a linha `POSTGRES_PASSWORD` para a mesma senha do .env.

---

## 🔥 PASSO 5: Configurar Firewall

```bash
# Instalar UFW
apt install ufw -y

# Configurar regras
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp

# Ativar firewall
ufw enable

# Verificar status
ufw status
```

---

## 🚀 PASSO 6: Iniciar o Sistema

```bash
# Construir e iniciar
docker compose up -d --build
```

⏳ Aguarde 5-10 minutos (primeira vez demora mais).

### Verificar se está rodando
```bash
docker compose ps
```

Deve mostrar `crm-postgres` e `crm-app` com status "Up" ou "Healthy".

---

## 📊 PASSO 7: Criar Banco e Usuário Admin

```bash
# Criar tabelas
docker compose exec crm prisma db push

# Criar usuário admin
docker compose exec crm tsx scripts/create-admin.ts
```

---

## ✅ PASSO 8: Acessar o Sistema

Abra no navegador:
```
http://SEU_IP_DA_VPS:3001
```

**Credenciais:**
- Usuário: `admin`
- Senha: `admin`

⚠️ **IMPORTANTE:** Troque a senha no primeiro acesso!

---

## 🌐 PASSO 9: Configurar Domínio (Opcional)

### 9.1 Apontar DNS
No painel da Hostinger ou seu provedor de domínio:
- Tipo: `A`
- Nome: `@` ou `crm`
- Valor: `SEU_IP_DA_VPS`

### 9.2 Instalar Nginx como proxy
```bash
apt install nginx -y

# Criar configuração
nano /etc/nginx/sites-available/crm
```

Colar:
```nginx
server {
    listen 80;
    server_name seu-dominio.com.br www.seu-dominio.com.br;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar:
```bash
ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 9.3 Instalar SSL (HTTPS)
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br
```

---

## 📊 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `docker compose ps` | Ver status dos containers |
| `docker compose logs -f` | Ver logs em tempo real |
| `docker compose logs crm` | Ver logs só da aplicação |
| `docker compose restart crm` | Reiniciar aplicação |
| `docker compose down` | Parar tudo |
| `docker compose up -d` | Iniciar tudo |
| `docker compose exec crm sh` | Acessar terminal do container |

---

## 🔄 Atualizar o Sistema

Quando houver atualizações no GitHub:

```bash
cd ~/crm-ymbale

# Puxar alterações
git pull

# Reconstruir e reiniciar
docker compose down
docker compose up -d --build
```

---

## 💾 Backup do Banco de Dados

### Criar backup
```bash
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar backup
```bash
cat backup.sql | docker compose exec -T postgres psql -U crm_user crm_ymbale
```

### Backup automático (crontab)
```bash
crontab -e
```
Adicionar:
```
0 3 * * * cd /root/crm-ymbale && docker compose exec -T postgres pg_dump -U crm_user crm_ymbale > /root/backups/backup_$(date +\%Y\%m\%d).sql
```

---

## 🆘 Solução de Problemas

### Container não inicia
```bash
docker compose logs crm
```

### Erro de conexão com banco
```bash
docker compose logs postgres
docker compose exec crm prisma db push
```

### Porta já em uso
```bash
# Ver o que está usando a porta
lsof -i :3001

# Matar processo (substitua PID)
kill -9 PID
```

### Verificar uso de recursos
```bash
docker stats
htop
```

### Limpar imagens antigas do Docker
```bash
docker system prune -a
```

---

## 💡 Dicas de Segurança

1. ✅ Use senhas fortes no banco de dados
2. ✅ Não exponha a porta 5432 (PostgreSQL) externamente
3. ✅ Configure SSL/HTTPS para produção
4. ✅ Mantenha o sistema atualizado (`apt update && apt upgrade`)
5. ✅ Faça backups regulares do banco
6. ✅ Configure fail2ban para proteção contra brute force
