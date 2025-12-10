# 🔒 Configurar SSL e Domínio - app.domseven.com.br

Guia completo para configurar SSL/HTTPS e fazer o domínio funcionar sem porta.

---

## 📋 Pré-requisitos

- ✅ Subdomínio `app.domseven.com.br` apontando para IP `72.60.242.235`
- ✅ Nginx instalado na VPS
- ✅ Aplicação rodando na porta 3000
- ✅ Acesso SSH à VPS

---

## 🚀 Passo a Passo Completo

### Passo 1: Verificar DNS

```bash
# Na VPS ou no seu computador, verificar se DNS está resolvendo
nslookup app.domseven.com.br
# ou
dig app.domseven.com.br

# Deve retornar: 72.60.242.235
```

### Passo 2: Instalar Certbot

```bash
# Atualizar sistema
apt update

# Instalar Certbot e plugin Nginx
apt install -y certbot python3-certbot-nginx

# Verificar instalação
certbot --version
```

### Passo 3: Configurar Nginx para o Domínio

```bash
# Criar/atualizar configuração do Nginx
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

# Habilitar site
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Se OK, reiniciar Nginx
systemctl restart nginx
systemctl enable nginx
```

### Passo 4: Obter Certificado SSL

```bash
# Obter certificado SSL automaticamente
certbot --nginx -d app.domseven.com.br

# O Certbot vai:
# 1. Verificar o domínio
# 2. Obter certificado SSL
# 3. Configurar Nginx automaticamente
# 4. Configurar renovação automática
```

**Durante a execução, o Certbot vai perguntar:**
- Email para notificações: **Digite seu email**
- Termos de serviço: **Digite 'A' para aceitar**
- Compartilhar email: **Digite 'N' para não compartilhar**
- Redirecionar HTTP para HTTPS: **Digite '2' para redirecionar**

### Passo 5: Verificar Configuração

```bash
# Verificar se certificado foi criado
ls -la /etc/letsencrypt/live/app.domseven.com.br/

# Verificar configuração do Nginx
cat /etc/nginx/sites-available/crm

# Verificar status do Nginx
systemctl status nginx

# Testar configuração
nginx -t
```

### Passo 6: Testar Acesso

```bash
# Testar HTTP (deve redirecionar para HTTPS)
curl -I http://app.domseven.com.br

# Testar HTTPS
curl -I https://app.domseven.com.br

# Verificar certificado
openssl s_client -connect app.domseven.com.br:443 -servername app.domseven.com.br < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

### Passo 7: Configurar Renovação Automática

```bash
# Verificar se renovação automática está configurada
certbot renew --dry-run

# Se funcionar, está tudo OK!
# O Certbot já configura renovação automática por padrão
```

### Passo 8: Atualizar Next.js para HTTPS (Opcional)

Se você usar cookies de sessão, pode precisar atualizar para usar HTTPS:

```bash
# Verificar arquivo de autenticação
# Se usar cookies, pode precisar configurar secure: true
```

---

## 🔍 Verificação Final

Após configurar, verifique:

1. **Acesse no navegador:**
   - `https://app.domseven.com.br` - Deve carregar com SSL
   - `http://app.domseven.com.br` - Deve redirecionar para HTTPS

2. **Verificar certificado:**
   - Clique no cadeado no navegador
   - Deve mostrar "Válido" e emitido por "Let's Encrypt"

3. **Testar funcionalidades:**
   - Login deve funcionar
   - Navegação deve funcionar
   - Sem erros de SSL no console

---

## 🐛 Troubleshooting

### Problema: Certbot não consegue verificar domínio

```bash
# Verificar se DNS está resolvendo corretamente
nslookup app.domseven.com.br

# Verificar se porta 80 está aberta
ufw allow 80/tcp
ufw allow 443/tcp

# Verificar se Nginx está rodando
systemctl status nginx

# Verificar logs
tail -50 /var/log/nginx/error.log
```

### Problema: Certificado não renova automaticamente

```bash
# Verificar cron job
systemctl list-timers | grep certbot

# OU
cat /etc/cron.d/certbot

# Testar renovação manual
certbot renew --dry-run
```

### Problema: Erro 502 Bad Gateway

```bash
# Verificar se aplicação está rodando
pm2 status

# Verificar se porta 3000 está acessível
curl http://localhost:3000

# Verificar logs do Nginx
tail -50 /var/log/nginx/error.log
```

### Problema: Redirecionamento infinito

```bash
# Verificar configuração do Nginx
cat /etc/nginx/sites-available/crm

# Verificar se há múltiplas configurações
ls -la /etc/nginx/sites-enabled/

# Verificar logs
tail -50 /var/log/nginx/error.log
```

---

## 📝 Configuração Final do Nginx (Após SSL)

Após o Certbot configurar, sua configuração deve ficar assim:

```nginx
server {
    listen 80;
    server_name app.domseven.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.domseven.com.br;
    
    ssl_certificate /etc/letsencrypt/live/app.domseven.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.domseven.com.br/privkey.pem;
    
    # Configurações SSL recomendadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
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
```

---

## ✅ Checklist Final

Após configurar, verifique:

- [ ] DNS está resolvendo corretamente (`nslookup app.domseven.com.br`)
- [ ] Nginx está rodando (`systemctl status nginx`)
- [ ] Certificado SSL foi obtido (`ls /etc/letsencrypt/live/app.domseven.com.br/`)
- [ ] HTTPS funciona (`curl -I https://app.domseven.com.br`)
- [ ] HTTP redireciona para HTTPS
- [ ] Site carrega em `https://app.domseven.com.br`
- [ ] Login funciona corretamente
- [ ] Renovação automática está configurada (`certbot renew --dry-run`)

---

## 🔄 Renovação do Certificado

O certificado Let's Encrypt expira em 90 dias, mas renova automaticamente.

**Verificar renovação:**
```bash
certbot renew --dry-run
```

**Renovar manualmente (se necessário):**
```bash
certbot renew
systemctl reload nginx
```

---

## 🆘 Comandos Úteis

```bash
# Ver certificados instalados
certbot certificates

# Revogar certificado (se necessário)
certbot revoke --cert-path /etc/letsencrypt/live/app.domseven.com.br/cert.pem

# Ver logs do Certbot
tail -50 /var/log/letsencrypt/letsencrypt.log

# Ver logs do Nginx
tail -50 /var/log/nginx/error.log
tail -50 /var/log/nginx/access.log

# Reiniciar Nginx
systemctl restart nginx

# Recarregar configuração (sem downtime)
systemctl reload nginx
```

---

**Execute os passos acima na ordem e seu domínio estará configurado com SSL!** 🔒

