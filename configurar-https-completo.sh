#!/bin/bash
# Script para configurar HTTPS e redirecionamento HTTP -> HTTPS
# Execute: bash configurar-https-completo.sh

set -e

echo "=========================================="
echo "  CONFIGURAR HTTPS E REDIRECIONAMENTO"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMINIO="app.domseven.com.br"

echo "1. Verificando se Nginx está rodando..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando${NC}"
else
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    echo "   Iniciando Nginx..."
    systemctl start nginx
    sleep 2
    if ! systemctl is-active --quiet nginx; then
        echo -e "${RED}❌ Não foi possível iniciar Nginx${NC}"
        exit 1
    fi
fi
echo ""

echo "2. Verificando se Certbot está instalado..."
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}⚠️  Certbot não encontrado. Instalando...${NC}"
    apt update
    apt install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✅ Certbot instalado${NC}"
else
    echo -e "${GREEN}✅ Certbot já instalado${NC}"
fi
echo ""

echo "3. Verificando configuração atual do Nginx..."
if [ -f "/etc/nginx/sites-available/crm" ]; then
    echo "   Arquivo existe"
    cat /etc/nginx/sites-available/crm
else
    echo -e "${YELLOW}⚠️  Arquivo não existe. Criando...${NC}"
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
    nginx -t
    systemctl reload nginx
    echo -e "${GREEN}✅ Configuração criada${NC}"
fi
echo ""

echo "4. Verificando se certificado SSL já existe..."
if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
    echo -e "${GREEN}✅ Certificado SSL já existe${NC}"
    echo "   Localização: /etc/letsencrypt/live/$DOMINIO/"
else
    echo -e "${YELLOW}⚠️  Certificado não encontrado${NC}"
    echo ""
    echo "5. Obtendo certificado SSL..."
    echo "------------------------------------------"
    echo -e "${YELLOW}⚠️  O Certbot vai fazer perguntas:${NC}"
    echo "   - Email: Digite seu email"
    echo "   - Termos: Digite 'A' para aceitar"
    echo "   - Compartilhar email: Digite 'N' ou 'Y'"
    echo "   - Redirecionar HTTP: Digite '2' para redirecionar"
    echo ""
    read -p "Pressione Enter para continuar..."
    
    certbot --nginx -d $DOMINIO --non-interactive --agree-tos --redirect --email david.ti.davi@gmail.com || certbot --nginx -d $DOMINIO
    
    if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
        echo -e "${GREEN}✅ Certificado obtido!${NC}"
    else
        echo -e "${RED}❌ Erro ao obter certificado${NC}"
        exit 1
    fi
fi
echo ""

echo "6. Verificando configuração do Nginx após Certbot..."
if grep -q "listen 443" /etc/nginx/sites-available/crm; then
    echo -e "${GREEN}✅ HTTPS já está configurado${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS não está configurado. Configurando manualmente...${NC}"
    
    # Criar configuração completa com HTTPS
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
    
    # Configurações SSL recomendadas
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
    
    nginx -t
    if [ $? -eq 0 ]; then
        systemctl reload nginx
        echo -e "${GREEN}✅ Configuração HTTPS aplicada${NC}"
    else
        echo -e "${RED}❌ Erro na configuração${NC}"
        exit 1
    fi
fi
echo ""

echo "7. Verificando se aplicação está rodando na porta 3000..."
if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✅ Aplicação está na porta 3000${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação não está na porta 3000${NC}"
    echo "   Iniciando aplicação..."
    cd ~/crm-ymbale
    pm2 start ecosystem.config.js || pm2 restart crm-ymbale
    pm2 save
    sleep 3
fi
echo ""

echo "8. Testando configuração..."
echo "------------------------------------------"
echo "Testando HTTP (deve redirecionar):"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMINIO)
echo "   Código HTTP: $HTTP_CODE"
if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✅ Redirecionamento HTTP -> HTTPS funcionando${NC}"
else
    echo -e "${YELLOW}⚠️  Redirecionamento pode não estar funcionando${NC}"
fi
echo ""

echo "Testando HTTPS:"
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://$DOMINIO)
echo "   Código HTTPS: $HTTPS_CODE"
if [ "$HTTPS_CODE" = "200" ] || [ "$HTTPS_CODE" = "301" ] || [ "$HTTPS_CODE" = "302" ]; then
    echo -e "${GREEN}✅ HTTPS funcionando${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS pode não estar funcionando${NC}"
fi
echo ""

echo "9. Verificação final..."
echo "------------------------------------------"
systemctl status nginx --no-pager | head -5
echo ""
echo "Certificados:"
certbot certificates 2>/dev/null | grep -A 5 "$DOMINIO" || echo "   Verificar manualmente"
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Configuração concluída!${NC}"
echo ""
echo "Acesse:"
echo "  - http://$DOMINIO (redireciona para HTTPS)"
echo "  - https://$DOMINIO (acesso seguro)"
echo ""
echo "Verificações:"
echo "  - Certificado SSL: ls /etc/letsencrypt/live/$DOMINIO/"
echo "  - Status Nginx: systemctl status nginx"
echo "  - Logs: tail -f /var/log/nginx/error.log"
echo ""

