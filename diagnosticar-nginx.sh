#!/bin/bash
# Script para diagnosticar e corrigir problemas do Nginx
# Execute: bash diagnosticar-nginx.sh

echo "=========================================="
echo "  DIAGNOSTICAR E CORRIGIR NGINX"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Verificando logs de erro do Nginx..."
echo "------------------------------------------"
journalctl -xeu nginx.service -n 30 --no-pager
echo ""

echo "2. Verificando configuração do Nginx..."
echo "------------------------------------------"
if nginx -t 2>&1; then
    echo -e "${GREEN}✅ Configuração OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    echo ""
    echo "3. Verificando arquivos de configuração..."
    echo "------------------------------------------"
    echo "Arquivos em sites-enabled:"
    ls -la /etc/nginx/sites-enabled/
    echo ""
    echo "Conteúdo do arquivo crm:"
    if [ -f "/etc/nginx/sites-enabled/crm" ]; then
        cat /etc/nginx/sites-enabled/crm
    elif [ -f "/etc/nginx/sites-available/crm" ]; then
        cat /etc/nginx/sites-available/crm
    else
        echo -e "${RED}❌ Arquivo de configuração não encontrado${NC}"
    fi
    echo ""
fi
echo ""

echo "4. Verificando se há processos Nginx rodando..."
echo "------------------------------------------"
ps aux | grep nginx | grep -v grep
if [ $? -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Há processos Nginx rodando${NC}"
    echo "   Parando processos..."
    pkill -9 nginx
    sleep 2
else
    echo -e "${GREEN}✅ Nenhum processo Nginx rodando${NC}"
fi
echo ""

echo "5. Verificando porta 80..."
echo "------------------------------------------"
if lsof -i :80 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Porta 80 está em uso${NC}"
    lsof -i :80
else
    echo -e "${GREEN}✅ Porta 80 está livre${NC}"
fi
echo ""

echo "6. Verificando se arquivo de configuração existe..."
echo "------------------------------------------"
if [ -f "/etc/nginx/sites-available/crm" ]; then
    echo -e "${GREEN}✅ Arquivo existe${NC}"
    echo "   Verificando conteúdo..."
    cat /etc/nginx/sites-available/crm
else
    echo -e "${RED}❌ Arquivo não existe!${NC}"
    echo "   Criando configuração básica..."
    
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
    
    ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    echo -e "${GREEN}✅ Configuração criada${NC}"
fi
echo ""

echo "7. Testando configuração novamente..."
echo "------------------------------------------"
if nginx -t; then
    echo -e "${GREEN}✅ Configuração válida${NC}"
    
    echo ""
    echo "8. Tentando iniciar Nginx..."
    echo "------------------------------------------"
    systemctl start nginx
    sleep 2
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx iniciado com sucesso!${NC}"
    else
        echo -e "${RED}❌ Nginx ainda não está rodando${NC}"
        echo "   Últimos logs:"
        journalctl -u nginx -n 20 --no-pager
    fi
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    echo "   Corrija os erros acima e tente novamente"
fi
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo ""
systemctl status nginx --no-pager | head -10
echo ""

