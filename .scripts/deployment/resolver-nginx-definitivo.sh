#!/bin/bash
# Script para resolver problema do Nginx definitivamente
# Execute: bash resolver-nginx-definitivo.sh

echo "=========================================="
echo "  RESOLVER NGINX DEFINITIVAMENTE"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Verificando estado da porta 80..."
echo "------------------------------------------"
lsof -i :80
netstat -tulpn | grep :80
ss -tulpn | grep :80
echo ""

echo "2. Verificando conexões TIME_WAIT..."
echo "------------------------------------------"
netstat -an | grep :80 | grep TIME_WAIT | head -5
echo ""

echo "3. Parando tudo novamente..."
echo "------------------------------------------"
pkill -9 nginx 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
pm2 stop all 2>/dev/null || true
sleep 3
echo ""

echo "4. Verificando configuração do Nginx..."
echo "------------------------------------------"
if nginx -t 2>&1; then
    echo -e "${GREEN}✅ Configuração OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    exit 1
fi
echo ""

echo "5. Tentando iniciar Nginx diretamente (sem systemd)..."
echo "------------------------------------------"
# Tentar iniciar diretamente para ver erro real
nginx -g "daemon off;" &
NGINX_PID=$!
sleep 2

if ps -p $NGINX_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx iniciou diretamente!${NC}"
    kill $NGINX_PID 2>/dev/null || true
    sleep 1
    echo ""
    echo "6. Iniciando via systemd..."
    systemctl start nginx
    sleep 2
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx iniciado via systemd!${NC}"
    else
        echo -e "${YELLOW}⚠️  Nginx não iniciou via systemd${NC}"
        echo "   Mas funcionou diretamente, pode ser problema de systemd"
    fi
else
    echo -e "${RED}❌ Nginx não iniciou nem diretamente${NC}"
    echo ""
    echo "7. Verificando se há problema de permissões..."
    ls -la /var/log/nginx/ 2>/dev/null || echo "   Diretório não existe"
    ls -la /var/cache/nginx/ 2>/dev/null || echo "   Diretório não existe"
    echo ""
    
    echo "8. Criando diretórios se não existirem..."
    mkdir -p /var/log/nginx/
    mkdir -p /var/cache/nginx/
    chown -R www-data:www-data /var/log/nginx/ 2>/dev/null || true
    chown -R www-data:www-data /var/cache/nginx/ 2>/dev/null || true
    echo ""
    
    echo "9. Tentando novamente..."
    nginx -t
    systemctl start nginx
    sleep 2
fi
echo ""

echo "10. Verificação final..."
echo "------------------------------------------"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando!${NC}"
    systemctl status nginx --no-pager | head -5
    echo ""
    lsof -i :80 | grep nginx || echo "   Nginx não encontrado na porta 80"
else
    echo -e "${RED}❌ Nginx ainda não está rodando${NC}"
    echo ""
    echo "   Últimos logs:"
    journalctl -u nginx -n 20 --no-pager
    echo ""
    echo "   Tentando método alternativo: reiniciar systemd"
    systemctl daemon-reload
    systemctl reset-failed nginx
    systemctl start nginx
    sleep 2
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx iniciou após reset!${NC}"
    else
        echo -e "${RED}❌ Ainda não funcionou${NC}"
        echo ""
        echo "   Verifique manualmente:"
        echo "   1. journalctl -xeu nginx.service"
        echo "   2. nginx -t"
        echo "   3. Verificar se há outro serviço usando porta 80"
    fi
fi
echo ""

echo "=========================================="
echo "  RESULTADO"
echo "=========================================="
echo ""
systemctl status nginx --no-pager | head -10
echo ""

