#!/bin/bash
# Script para resolver TUDO e configurar HTTPS
# Execute: bash resolver-tudo-https.sh

set -e

echo "=========================================="
echo "  RESOLVER TUDO E CONFIGURAR HTTPS"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMINIO="app.domseven.com.br"

echo "1. Parando TODOS processos na porta 80..."
echo "------------------------------------------"
# Encontrar e parar todos processos na porta 80
lsof -ti :80 | xargs kill -9 2>/dev/null || true
pkill -9 next-server 2>/dev/null || true
pkill -9 node 2>/dev/null || true
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
sleep 5
echo ""

echo "2. Verificando se porta 80 está livre..."
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 ainda está em uso!${NC}"
    echo "   Processos:"
    lsof -i :80
    echo ""
    echo "   Forçando parada..."
    lsof -ti :80 | xargs kill -9 2>/dev/null || true
    sleep 3
    
    if lsof -i :80 2>/dev/null | grep -q LISTEN; then
        echo -e "${RED}❌ Não foi possível liberar porta 80${NC}"
        echo "   Pode ser necessário reiniciar o servidor"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Porta 80 está livre${NC}"
echo ""

echo "3. Garantindo que aplicação vai na porta 3000..."
echo "------------------------------------------"
cd ~/crm-ymbale

# Verificar .env
if [ -f ".env" ]; then
    if grep -q "PORT=80" .env; then
        echo "   Corrigindo PORT no .env..."
        sed -i 's/PORT=80/PORT=3000/g' .env
        sed -i 's/PORT = 80/PORT = 3000/g' .env
        echo -e "${GREEN}✅ .env corrigido${NC}"
    fi
fi

# Atualizar ecosystem.config.js
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
echo -e "${GREEN}✅ ecosystem.config.js atualizado${NC}"
echo ""

echo "4. Iniciando aplicação na porta 3000..."
pm2 start ecosystem.config.js
pm2 save
sleep 5

if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✅ Aplicação está na porta 3000${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação pode não estar na porta 3000${NC}"
    pm2 logs crm-ymbale --lines 5 --nostream
fi
echo ""

echo "5. Configurando Nginx para HTTP (porta 80)..."
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

# Testar configuração
if nginx -t; then
    echo -e "${GREEN}✅ Configuração OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    exit 1
fi
echo ""

echo "6. Iniciando Nginx..."
systemctl start nginx
sleep 3

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando!${NC}"
else
    echo -e "${RED}❌ Nginx não iniciou${NC}"
    journalctl -u nginx -n 10 --no-pager
    exit 1
fi
echo ""

echo "7. Verificando se HTTP está funcionando..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302\|307"; then
    echo -e "${GREEN}✅ HTTP está funcionando${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP pode não estar funcionando${NC}"
fi
echo ""

echo "8. Obtendo certificado SSL..."
echo "------------------------------------------"
echo -e "${YELLOW}⚠️  O Certbot vai fazer perguntas:${NC}"
echo "   - Email: Digite seu email"
echo "   - Termos: Digite 'A' para aceitar"
echo "   - Compartilhar email: Digite 'N' ou 'Y'"
echo "   - Redirecionar HTTP: Digite '2' para redirecionar"
echo ""

# Tentar obter certificado
certbot --nginx -d $DOMINIO || {
    echo -e "${YELLOW}⚠️  Certbot falhou. Tentando obter certificado standalone...${NC}"
    
    # Parar Nginx temporariamente
    systemctl stop nginx
    
    # Obter certificado em modo standalone
    certbot certonly --standalone -d $DOMINIO --non-interactive --agree-tos --email david.ti.davi@gmail.com || certbot certonly --standalone -d $DOMINIO
    
    # Reiniciar Nginx
    systemctl start nginx
}
echo ""

echo "9. Verificando se certificado foi obtido..."
if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
    echo -e "${GREEN}✅ Certificado obtido!${NC}"
else
    echo -e "${RED}❌ Certificado não foi obtido${NC}"
    echo "   Verifique os logs: tail -50 /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi
echo ""

echo "10. Configurando Nginx com HTTPS e redirecionamento..."
echo "------------------------------------------"
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

# Testar configuração
if nginx -t; then
    echo -e "${GREEN}✅ Configuração HTTPS OK${NC}"
    systemctl reload nginx
    echo -e "${GREEN}✅ Nginx recarregado${NC}"
else
    echo -e "${RED}❌ Erro na configuração HTTPS${NC}"
    nginx -t
    exit 1
fi
echo ""

echo "11. Verificação final..."
echo "------------------------------------------"
echo "Testando HTTP (deve redirecionar):"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMINIO)
echo "   Código: $HTTP_CODE"
if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✅ Redirecionamento HTTP -> HTTPS funcionando!${NC}"
else
    echo -e "${YELLOW}⚠️  Redirecionamento pode não estar funcionando${NC}"
fi
echo ""

echo "Testando HTTPS:"
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://$DOMINIO 2>/dev/null || echo "000")
echo "   Código: $HTTPS_CODE"
if [ "$HTTPS_CODE" = "200" ] || [ "$HTTPS_CODE" = "301" ] || [ "$HTTPS_CODE" = "302" ] || [ "$HTTPS_CODE" = "307" ]; then
    echo -e "${GREEN}✅ HTTPS funcionando!${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS pode não estar funcionando (código: $HTTPS_CODE)${NC}"
fi
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Configuração concluída!${NC}"
echo ""
echo "Status:"
systemctl status nginx --no-pager | head -5
echo ""
pm2 status
echo ""
echo "Acesse:"
echo "  - http://$DOMINIO (redireciona para HTTPS)"
echo "  - https://$DOMINIO (acesso seguro)"
echo ""
echo "Verificações:"
echo "  - Certificado: ls /etc/letsencrypt/live/$DOMINIO/"
echo "  - Porta 80: lsof -i :80 | grep nginx"
echo "  - Porta 443: lsof -i :443 | grep nginx"
echo ""

