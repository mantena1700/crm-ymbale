#!/bin/bash
# Script para Configurar SSL e Domínio
# Execute: bash configurar-ssl-dominio.sh

set -e

echo "=========================================="
echo "  CONFIGURAR SSL E DOMINIO"
echo "  app.domseven.com.br"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMINIO="app.domseven.com.br"
IP_VPS="72.60.242.235"

# Passo 1: Verificar DNS
echo "1. Verificando DNS..."
DNS_IP=$(dig +short $DOMINIO | tail -1)
if [ "$DNS_IP" = "$IP_VPS" ]; then
    echo -e "${GREEN}✅ DNS configurado corretamente: $DOMINIO -> $DNS_IP${NC}"
else
    echo -e "${YELLOW}⚠️  DNS pode não estar configurado corretamente${NC}"
    echo "   Esperado: $IP_VPS"
    echo "   Encontrado: $DNS_IP"
    echo "   Continuando mesmo assim..."
fi
echo ""

# Passo 2: Instalar Certbot
echo "2. Verificando Certbot..."
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}⚠️  Certbot não encontrado. Instalando...${NC}"
    apt update
    apt install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✅ Certbot instalado${NC}"
else
    echo -e "${GREEN}✅ Certbot já instalado${NC}"
fi
echo ""

# Passo 3: Configurar Nginx
echo "3. Configurando Nginx..."
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

# Habilitar site
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
if nginx -t; then
    echo -e "${GREEN}✅ Configuração do Nginx válida${NC}"
    systemctl restart nginx
    echo -e "${GREEN}✅ Nginx reiniciado${NC}"
else
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    exit 1
fi
echo ""

# Passo 4: Verificar se aplicação está rodando
echo "4. Verificando aplicação..."
if pm2 list | grep -q crm-ymbale; then
    echo -e "${GREEN}✅ Aplicação está rodando${NC}"
    if curl -s http://localhost:3000 > /dev/null; then
        echo -e "${GREEN}✅ Aplicação respondendo na porta 3000${NC}"
    else
        echo -e "${YELLOW}⚠️  Aplicação pode não estar respondendo${NC}"
    fi
else
    echo -e "${RED}❌ Aplicação não está rodando!${NC}"
    echo "   Execute: pm2 start ecosystem.config.js"
    exit 1
fi
echo ""

# Passo 5: Obter certificado SSL
echo "5. Obtendo certificado SSL..."
echo -e "${YELLOW}⚠️  ATENÇÃO: O Certbot vai fazer perguntas interativas${NC}"
echo "   - Email: Digite seu email"
echo "   - Termos: Digite 'A' para aceitar"
echo "   - Compartilhar email: Digite 'N'"
echo "   - Redirecionar HTTP: Digite '2' para redirecionar"
echo ""
read -p "Pressione Enter para continuar..."

certbot --nginx -d $DOMINIO

echo ""
echo -e "${GREEN}✅ Certificado SSL obtido!${NC}"
echo ""

# Passo 6: Verificar certificado
echo "6. Verificando certificado..."
if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
    echo -e "${GREEN}✅ Certificado encontrado${NC}"
    echo "   Localização: /etc/letsencrypt/live/$DOMINIO/"
else
    echo -e "${RED}❌ Certificado não encontrado${NC}"
    exit 1
fi
echo ""

# Passo 7: Testar renovação
echo "7. Testando renovação automática..."
if certbot renew --dry-run > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Renovação automática configurada${NC}"
else
    echo -e "${YELLOW}⚠️  Renovação automática pode não estar configurada${NC}"
fi
echo ""

# Passo 8: Verificar firewall
echo "8. Verificando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    echo -e "${GREEN}✅ Portas 80 e 443 abertas${NC}"
else
    echo -e "${YELLOW}⚠️  UFW não encontrado. Configure firewall manualmente${NC}"
fi
echo ""

# Resumo
echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Configuração concluída!${NC}"
echo ""
echo "Acesse seu site:"
echo "  - HTTPS: https://$DOMINIO"
echo "  - HTTP: http://$DOMINIO (redireciona para HTTPS)"
echo ""
echo "Verificações:"
echo "  1. Acesse https://$DOMINIO no navegador"
echo "  2. Verifique o cadeado (SSL válido)"
echo "  3. Teste o login"
echo ""
echo "Comandos úteis:"
echo "  - Ver certificados: certbot certificates"
echo "  - Renovar manualmente: certbot renew"
echo "  - Ver logs: tail -f /var/log/nginx/error.log"
echo ""
echo "=========================================="

