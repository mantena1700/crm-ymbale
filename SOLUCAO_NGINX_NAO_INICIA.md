# 🔧 Solução: Nginx Não Inicia

## 🔍 Diagnóstico

Execute estes comandos para ver o erro específico:

```bash
# 1. Ver logs detalhados do Nginx
journalctl -xeu nginx.service -n 50

# 2. Verificar configuração
nginx -t

# 3. Verificar arquivos de configuração
ls -la /etc/nginx/sites-enabled/
cat /etc/nginx/sites-enabled/crm
```

## ⚡ Solução Rápida

### Passo 1: Ver o Erro Específico

```bash
journalctl -xeu nginx.service -n 50
```

### Passo 2: Verificar Configuração

```bash
nginx -t
```

### Passo 3: Corrigir Baseado no Erro

**Se o erro for "file not found" ou "syntax error":**

```bash
# Recriar configuração
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
```

**Se o erro for "port already in use":**

```bash
# Ver o que está usando a porta 80
lsof -i :80
netstat -tulpn | grep :80

# Parar processos
pkill -9 nginx
systemctl stop nginx

# Tentar novamente
systemctl start nginx
```

**Se o erro for "permission denied":**

```bash
# Verificar permissões
ls -la /etc/nginx/
ls -la /var/log/nginx/

# Corrigir permissões se necessário
chown -R www-data:www-data /var/log/nginx/
```

## 🔄 Solução Completa (Script)

Execute o script de diagnóstico:

```bash
cd ~/crm-ymbale
bash diagnosticar-nginx.sh
```

## 🐛 Problemas Comuns

### Problema: "emerg: bind() to 0.0.0.0:80 failed"

```bash
# Verificar o que está usando porta 80
lsof -i :80

# Parar tudo
pkill -9 nginx
systemctl stop nginx
fuser -k 80/tcp

# Aguardar
sleep 3

# Iniciar
systemctl start nginx
```

### Problema: "emerg: open() failed"

```bash
# Verificar se diretórios existem
ls -la /var/log/nginx/
ls -la /etc/nginx/

# Criar diretórios se não existirem
mkdir -p /var/log/nginx/
mkdir -p /var/cache/nginx/

# Corrigir permissões
chown -R www-data:www-data /var/log/nginx/
chown -R www-data:www-data /var/cache/nginx/
```

### Problema: "syntax error"

```bash
# Verificar sintaxe
nginx -t

# Ver arquivo problemático
cat /etc/nginx/sites-enabled/crm

# Recriar configuração (ver Passo 3 acima)
```

## ✅ Verificação Final

Após corrigir:

```bash
# 1. Testar configuração
nginx -t

# 2. Iniciar Nginx
systemctl start nginx

# 3. Verificar status
systemctl status nginx

# 4. Verificar se está rodando
curl http://localhost

# 5. Tentar Certbot novamente
certbot --nginx -d app.domseven.com.br
```

---

**Execute primeiro `journalctl -xeu nginx.service -n 50` para ver o erro específico!** 🎯

