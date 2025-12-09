# 🎯 Solução Completa - Porta 80 e Erro de Cliente

## 🔍 Problemas Identificados

1. **Sem porta (porta 80):** Não há Nginx configurado como proxy reverso
2. **Com porta 3000:** Erro "Application error: a client-side exception"

## ⚡ Solução Completa - Execute na VPS

### Passo 1: Corrigir o Erro de Cliente (Porta 3000)

```bash
cd ~/crm-ymbale

# 1. Parar aplicação
pm2 stop crm-ymbale
pm2 delete crm-ymbale

# 2. Limpar build e rebuild
rm -rf .next
npm run build

# 3. Usar npm start (mais confiável que standalone)
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    script: 'npm',
    args: 'start',
    cwd: process.cwd(),
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
EOF

# 4. Reiniciar
pm2 start ecosystem.config.js
pm2 save

# 5. Aguardar e testar
sleep 5
curl http://localhost:3000 | head -20
pm2 status
```

### Passo 2: Configurar Nginx para Porta 80

```bash
# 1. Instalar Nginx (se não estiver instalado)
apt update
apt install -y nginx

# 2. Criar configuração do Nginx
cat > /etc/nginx/sites-available/crm << 'EOF'
server {
    listen 80;
    server_name _;  # Aceita qualquer domínio/IP
    
    # Aumentar tamanho de upload
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Cache para arquivos estáticos
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 3. Habilitar site
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# 4. Remover configuração padrão (se existir)
rm -f /etc/nginx/sites-enabled/default

# 5. Testar configuração
nginx -t

# 6. Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx

# 7. Verificar status
systemctl status nginx
```

### Passo 3: Verificar Firewall

```bash
# Verificar se porta 80 está aberta
ufw status

# Se não estiver, abrir portas
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

# Verificar se está ativo
ufw status verbose
```

### Passo 4: Verificação Final

```bash
# 1. Testar porta 3000 (direto)
curl http://localhost:3000 | head -20

# 2. Testar porta 80 (via Nginx)
curl http://localhost:80 | head -20
# ou
curl http://localhost | head -20

# 3. Verificar status
pm2 status
systemctl status nginx

# 4. Ver logs
pm2 logs crm-ymbale --lines 20
tail -20 /var/log/nginx/error.log
```

---

## 🔍 Diagnóstico

Se ainda não funcionar, execute:

```bash
# 1. Verificar se Nginx está rodando
systemctl status nginx

# 2. Verificar se PM2 está rodando
pm2 status

# 3. Verificar se porta 3000 está acessível
netstat -tulpn | grep :3000

# 4. Verificar se porta 80 está acessível
netstat -tulpn | grep :80

# 5. Ver logs do Nginx
tail -50 /var/log/nginx/error.log
tail -50 /var/log/nginx/access.log

# 6. Ver logs do PM2
pm2 logs crm-ymbale --err --lines 50
```

---

## 🐛 Problemas Comuns

### Problema: Nginx não inicia

```bash
# Verificar configuração
nginx -t

# Ver logs de erro
journalctl -u nginx -n 50

# Verificar se porta 80 está livre
lsof -i :80
```

### Problema: "502 Bad Gateway"

```bash
# Verificar se aplicação está rodando
pm2 status

# Verificar se porta 3000 está acessível
curl http://localhost:3000

# Verificar logs do Nginx
tail -50 /var/log/nginx/error.log
```

### Problema: Erro de cliente persiste

```bash
# Verificar console do navegador (F12)
# Ver quais arquivos estão falhando (aba Network)

# Verificar se arquivos estáticos estão acessíveis
curl http://localhost:3000/_next/static/chunks/main.js

# Limpar cache do navegador
# Ctrl+Shift+Delete ou Cmd+Shift+Delete
```

---

## ✅ Checklist Final

Após aplicar todas as correções:

- [ ] `pm2 status` mostra `online`
- [ ] `systemctl status nginx` mostra `active (running)`
- [ ] `curl http://localhost:3000` retorna HTML
- [ ] `curl http://localhost` retorna HTML (via Nginx)
- [ ] Site carrega em `http://SEU_IP` (sem porta)
- [ ] Site carrega em `http://SEU_IP:3000` (com porta)
- [ ] Não há erro "Application error" no navegador
- [ ] Console do navegador (F12) não mostra erros

---

**Execute os passos acima na ordem e o problema deve ser resolvido!** 🎯

