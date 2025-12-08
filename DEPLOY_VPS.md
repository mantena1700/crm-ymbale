# 🚀 Deploy do CRM Ymbale em VPS

Guia completo para instalar o CRM Ymbale em uma VPS Ubuntu.

## 📋 Requisitos da VPS

| Requisito | Mínimo |
|-----------|--------|
| **RAM** | 2 GB |
| **CPU** | 1 vCPU |
| **Disco** | 20 GB |
| **Sistema** | Ubuntu 22.04 ou 24.04 |

---

## 🔧 INSTALAÇÃO PASSO A PASSO

### 1️⃣ Conectar na VPS via SSH

```bash
ssh root@SEU_IP_DA_VPS
```

### 2️⃣ Atualizar sistema e instalar dependências

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg lsb-release git ufw
```

### 3️⃣ Instalar Docker (para PostgreSQL)

```bash
# Adicionar repositório Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 4️⃣ Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### 5️⃣ Configurar Firewall

```bash
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 6️⃣ Clonar o repositório

```bash
cd /root
git clone https://github.com/mantena1700/crm-ymbale.git
cd crm-ymbale
```

### 7️⃣ Iniciar PostgreSQL

```bash
docker compose up -d postgres
sleep 10
```

### 8️⃣ Configurar ambiente

```bash
# Criar .env
cat > .env << 'EOF'
DATABASE_URL="postgresql://crm_user:crm_senha_segura_2024@localhost:5432/crm_ymbale?schema=public"
NODE_ENV=production
EOF
```

### 9️⃣ Instalar dependências e fazer build

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
```

### 🔟 Criar usuário administrador

```bash
npx tsx scripts/create-admin.ts
```

### 1️⃣1️⃣ Preparar e iniciar aplicação

```bash
# Copiar arquivos para standalone
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Iniciar em background
cd .next/standalone
nohup node server.js > /var/log/crm.log 2>&1 &
```

---

## 🔄 Configurar Serviço Systemd (Auto-iniciar)

```bash
cat > /etc/systemd/system/crm.service << 'EOF'
[Unit]
Description=CRM Ymbale
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/crm-ymbale/.next/standalone
Environment=PORT=80
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://crm_user:crm_senha_segura_2024@localhost:5432/crm_ymbale?schema=public
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable crm
systemctl start crm
```

---

## 🌐 Acessar o Sistema

```
http://SEU_IP_DA_VPS
```

**Credenciais padrão:**
- Usuário: `admin`
- Senha: `admin`

⚠️ **Troque a senha no primeiro acesso!**

---

## 📊 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `systemctl status crm` | Ver status do CRM |
| `systemctl restart crm` | Reiniciar CRM |
| `systemctl stop crm` | Parar CRM |
| `journalctl -u crm -f` | Ver logs em tempo real |
| `docker compose ps` | Ver status do PostgreSQL |
| `docker compose logs postgres` | Ver logs do banco |

---

## 🔄 Atualizar o Sistema

```bash
cd /root/crm-ymbale
git pull
npm install
npx prisma generate
npx prisma db push
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
systemctl restart crm
```

---

## 💾 Backup do Banco

```bash
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d).sql
```

## 📥 Restaurar Backup

```bash
docker compose exec -T postgres psql -U crm_user crm_ymbale < backup.sql
```

---

## 🔒 Configurar HTTPS (Opcional)

Para habilitar HTTPS, instale o Nginx e Certbot:

```bash
apt install -y nginx certbot python3-certbot-nginx

# Configurar proxy reverso
cat > /etc/nginx/sites-available/crm << 'EOF'
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
    }
}
EOF

ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Obter certificado SSL
certbot --nginx -d seu-dominio.com
```

Após habilitar HTTPS, edite `src/app/api/auth/login/route.ts` e mude `secure: false` para `secure: true`.
