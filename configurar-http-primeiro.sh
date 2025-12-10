#!/bin/bash
# Script para configurar HTTP primeiro, depois HTTPS
# Execute: bash configurar-http-primeiro.sh

set -e

echo "=========================================="
echo "  CONFIGURAR HTTP PRIMEIRO"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMINIO="app.domseven.com.br"

echo "1. Removendo configuração HTTPS (certificado não existe ainda)..."
echo "------------------------------------------"
cat > /etc/nginx/sites-available/crm << EOF
server {
    listen 80;
    server_name $DOMINIO;
    
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
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

ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo -e "${GREEN}✅ Configuração HTTP criada${NC}"
echo ""

echo "2. Testando configuração..."
if nginx -t; then
    echo -e "${GREEN}✅ Configuração OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    nginx -t
    exit 1
fi
echo ""

echo "3. Verificando se porta 80 está livre..."
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 está em uso${NC}"
    lsof -i :80
    echo ""
    echo "   Parando processos..."
    lsof -ti :80 | xargs kill -9 2>/dev/null || true
    pkill -9 next-server 2>/dev/null || true
    sleep 3
else
    echo -e "${GREEN}✅ Porta 80 está livre${NC}"
fi
echo ""

echo "4. Iniciando Nginx..."
systemctl start nginx
sleep 2

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx iniciado!${NC}"
else
    echo -e "${RED}❌ Nginx não iniciou${NC}"
    journalctl -u nginx -n 10 --no-pager
    exit 1
fi
echo ""

echo "5. Verificando se aplicação está na porta 3000..."
if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✅ Aplicação está na porta 3000${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação não está na porta 3000${NC}"
    echo "   Iniciando..."
    cd ~/crm-ymbale
    pm2 start ecosystem.config.js || pm2 restart crm-ymbale
    pm2 save
    sleep 3
fi
echo ""

echo "6. Testando HTTP..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
echo "   Código HTTP: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ]; then
    echo -e "${GREEN}✅ HTTP está funcionando!${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP pode não estar funcionando${NC}"
fi
echo ""

echo "7. Verificando se certificado SSL existe..."
if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
    echo -e "${GREEN}✅ Certificado SSL existe${NC}"
    echo ""
    echo "8. Configurando HTTPS..."
    cat > /etc/nginx/sites-available/crm << EOF
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name $DOMINIO;
    return 301 https://\$server_name\$request_uri;
}

# Servidor HTTPS
server {
    listen 443 ssl http2;
    server_name $DOMINIO;
    
    ssl_certificate /etc/letsencrypt/live/$DOMINIO/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMINIO/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
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
    
    if nginx -t; then
        systemctl reload nginx
        echo -e "${GREEN}✅ HTTPS configurado!${NC}"
    else
        echo -e "${RED}❌ Erro na configuração HTTPS${NC}"
        nginx -t
    fi
else
    echo -e "${YELLOW}⚠️  Certificado SSL não existe${NC}"
    echo ""
    echo "9. Obtendo certificado SSL..."
    echo "------------------------------------------"
    echo -e "${YELLOW}⚠️  O Certbot vai fazer perguntas:${NC}"
    echo "   - Email: Digite seu email"
    echo "   - Termos: Digite 'A' para aceitar"
    echo "   - Compartilhar email: Digite 'N' ou 'Y'"
    echo "   - Redirecionar HTTP: Digite '2' para redirecionar"
    echo ""
    read -p "Pressione Enter para continuar..."
    
    certbot --nginx -d $DOMINIO
    
    if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
        echo -e "${GREEN}✅ Certificado obtido!${NC}"
        echo ""
        echo "   O Certbot já configurou HTTPS automaticamente"
        echo "   Verificando configuração..."
        nginx -t
        systemctl reload nginx
    else
        echo -e "${YELLOW}⚠️  Certificado não foi obtido${NC}"
        echo "   Mas HTTP está funcionando!"
    fi
fi
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo ""
systemctl status nginx --no-pager | head -5
echo ""
pm2 status
echo ""
echo "Teste:"
echo "  curl -I http://$DOMINIO"
echo "  curl -I https://$DOMINIO"
echo ""

