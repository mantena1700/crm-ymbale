# 🔒 Configurar HTTPS e Redirecionamento HTTP -> HTTPS

## 🎯 Objetivo

Configurar SSL/HTTPS e fazer com que todas as requisições HTTP sejam redirecionadas para HTTPS.

---

## ⚡ Solução Rápida

Execute na VPS:

```bash
cd ~/crm-ymbale
bash configurar-https-completo.sh
```

---

## 📋 Passo a Passo Manual

### Passo 1: Verificar se Nginx está rodando

```bash
systemctl status nginx
# Se não estiver, iniciar:
systemctl start nginx
```

### Passo 2: Obter Certificado SSL

```bash
# Se ainda não tiver certificado
certbot --nginx -d app.domseven.com.br

# Durante a execução:
# - Email: seu email
# - Termos: A (aceitar)
# - Compartilhar: N ou Y
# - Redirecionar: 2 (redirecionar HTTP para HTTPS)
```

### Passo 3: Verificar Configuração

Após o Certbot, verifique se a configuração está correta:

```bash
cat /etc/nginx/sites-available/crm
```

Deve ter algo assim:

```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name app.domseven.com.br;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS
server {
    listen 443 ssl http2;
    server_name app.domseven.com.br;
    
    ssl_certificate /etc/letsencrypt/live/app.domseven.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.domseven.com.br/privkey.pem;
    
    # ... resto da configuração
}
```

### Passo 4: Se Não Estiver Configurado, Configurar Manualmente

```bash
cat > /etc/nginx/sites-available/crm << 'EOF'
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name app.domseven.com.br;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS
server {
    listen 443 ssl http2;
    server_name app.domseven.com.br;
    
    ssl_certificate /etc/letsencrypt/live/app.domseven.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.domseven.com.br/privkey.pem;
    
    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
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

# Testar configuração
nginx -t

# Se OK, recarregar
systemctl reload nginx
```

---

## ✅ Verificação

Após configurar:

```bash
# 1. Testar HTTP (deve redirecionar)
curl -I http://app.domseven.com.br
# Deve retornar: HTTP/1.1 301 Moved Permanently

# 2. Testar HTTPS
curl -I https://app.domseven.com.br
# Deve retornar: HTTP/2 200 ou 301/302

# 3. Verificar certificado
openssl s_client -connect app.domseven.com.br:443 -servername app.domseven.com.br < /dev/null 2>/dev/null | openssl x509 -noout -dates

# 4. Ver status
systemctl status nginx
```

---

## 🐛 Problemas Comuns

### Problema: Certbot não consegue obter certificado

```bash
# Verificar DNS
nslookup app.domseven.com.br
# Deve retornar: 72.60.242.235

# Verificar se porta 80 está acessível
curl -I http://app.domseven.com.br

# Tentar novamente
certbot --nginx -d app.domseven.com.br --dry-run
```

### Problema: HTTPS não carrega

```bash
# Verificar se certificado existe
ls -la /etc/letsencrypt/live/app.domseven.com.br/

# Verificar configuração
nginx -t
cat /etc/nginx/sites-available/crm | grep ssl_certificate

# Ver logs
tail -50 /var/log/nginx/error.log
```

### Problema: HTTP não redireciona

```bash
# Verificar se há bloco de redirecionamento
grep "return 301" /etc/nginx/sites-available/crm

# Se não houver, adicionar (ver Passo 4 acima)
```

---

## 🔄 Renovação Automática

O Certbot já configura renovação automática. Verificar:

```bash
certbot renew --dry-run
```

---

**Execute o script `configurar-https-completo.sh` e tudo será configurado automaticamente!** 🎯

