# 🔒 Guia Definitivo: Configurar SSL/HTTPS

Baseado na solução que funcionou!

---

## 🎯 Problema Identificado

Processo Next.js "fantasma" na porta 80 estava bloqueando o Nginx.

---

## ✅ Solução Passo a Passo

### Passo 1: Verificar e Limpar Processos Fantasmas

```bash
# Verificar processos na porta 80
lsof -i :80

# Se encontrar processo Next.js na porta 80, parar:
kill -9 PID

# OU usar script automático
bash limpar-processos-fantasma.sh
```

### Passo 2: Garantir Aplicação na Porta 3000

```bash
cd ~/crm-ymbale

# Verificar .env
grep PORT .env
# Se tiver PORT=80, corrigir:
sed -i 's/PORT=80/PORT=3000/g' .env

# Garantir ecosystem.config.js
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

# Reiniciar aplicação
pm2 restart crm-ymbale
pm2 save
```

### Passo 3: Configurar Nginx (HTTP primeiro)

```bash
# Configurar apenas HTTP (sem SSL ainda)
cat > /etc/nginx/sites-available/crm << 'EOF'
server {
    listen 80;
    server_name app.domseven.com.br;
    
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
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Habilitar
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar
nginx -t

# Iniciar
systemctl start nginx
systemctl status nginx
```

### Passo 4: Obter Certificado SSL

```bash
# Obter certificado
certbot --nginx -d app.domseven.com.br

# Durante a execução:
# - Email: seu email
# - Termos: A (aceitar)
# - Compartilhar: N ou Y
# - Redirecionar: 2 (redirecionar HTTP para HTTPS)
```

O Certbot vai:
1. Obter o certificado SSL
2. Configurar HTTPS automaticamente
3. Configurar redirecionamento HTTP -> HTTPS

### Passo 5: Verificação

```bash
# Testar HTTP (deve redirecionar)
curl -I http://app.domseven.com.br
# Deve retornar: HTTP/1.1 301 Moved Permanently

# Testar HTTPS
curl -I https://app.domseven.com.br
# Deve retornar: HTTP/2 200 ou similar

# Verificar certificado
certbot certificates
```

---

## 🛡️ Prevenção de Processos Fantasmas

### Sempre verificar antes de fazer deploy:

```bash
# Verificar processos na porta 80
lsof -i :80

# Verificar processos na porta 3000
lsof -i :3000

# Verificar PM2
pm2 list

# Verificar processos Node fora do PM2
ps aux | grep -E "node|next" | grep -v grep | grep -v pm2
```

### Scripts de Verificação:

```bash
# Verificar processos fantasmas
bash verificar-processos-fantasma.sh

# Limpar processos fantasmas
bash limpar-processos-fantasma.sh
```

---

## 📋 Arquitetura Correta

```
Internet
   ↓
app.domseven.com.br (porta 80/443)
   ↓
Nginx (proxy reverso)
   ↓
Next.js (porta 3000 - PM2)
```

### Portas:
- **80**: Nginx HTTP (redireciona para HTTPS)
- **443**: Nginx HTTPS
- **3000**: Next.js (interno, gerenciado pelo PM2)

---

## 🚨 Regras de Ouro

1. **NUNCA** rode Next.js diretamente na porta 80
2. **SEMPRE** use PM2 para gerenciar a aplicação
3. **SEMPRE** verifique processos fantasmas antes de configurar SSL
4. **SEMPRE** configure HTTP primeiro, depois HTTPS

---

## 📝 Comandos Rápidos

```bash
# Verificar tudo
lsof -i :80
lsof -i :3000
pm2 list

# Limpar processos fantasmas
bash limpar-processos-fantasma.sh

# Reiniciar tudo
pm2 restart crm-ymbale
systemctl restart nginx

# Ver logs
pm2 logs crm-ymbale
journalctl -u nginx -f
```

---

**Agora você tem o guia completo baseado na solução que funcionou!** 🎯

