#!/bin/bash
# Script para corrigir problema de porta 80 em uso
# Execute: bash corrigir-porta-80.sh

echo "=========================================="
echo "  CORRIGIR PORTA 80 EM USO"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Verificando o que está usando a porta 80..."
echo ""

# Verificar processos na porta 80
PORT_80_PROCESS=$(lsof -i :80 2>/dev/null || netstat -tulpn | grep :80 || ss -tulpn | grep :80)

if [ -z "$PORT_80_PROCESS" ]; then
    echo -e "${YELLOW}⚠️  Não foi possível identificar processo na porta 80${NC}"
    echo "   Tentando outras formas..."
    echo ""
    
    # Tentar com fuser
    if command -v fuser &> /dev/null; then
        echo "   Usando fuser..."
        fuser 80/tcp
    fi
else
    echo "   Processos encontrados na porta 80:"
    echo "$PORT_80_PROCESS"
    echo ""
fi

echo "2. Verificando se há múltiplas instâncias do Nginx..."
NGINX_PROCESSES=$(ps aux | grep nginx | grep -v grep | wc -l)
echo "   Instâncias do Nginx: $NGINX_PROCESSES"
echo ""

if [ "$NGINX_PROCESSES" -gt 1 ]; then
    echo -e "${YELLOW}⚠️  Múltiplas instâncias do Nginx encontradas${NC}"
    echo "   Processos:"
    ps aux | grep nginx | grep -v grep
    echo ""
fi

echo "3. Verificando status do Nginx..."
systemctl status nginx --no-pager | head -10
echo ""

echo "4. Parando Nginx..."
systemctl stop nginx
sleep 2
echo ""

echo "5. Verificando se porta 80 está livre agora..."
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 ainda está em uso!${NC}"
    echo "   Processos:"
    lsof -i :80
    echo ""
    echo "   Tentando parar processos..."
    
    # Tentar parar processos na porta 80
    lsof -ti :80 | xargs kill -9 2>/dev/null || true
    sleep 2
else
    echo -e "${GREEN}✅ Porta 80 está livre${NC}"
fi
echo ""

echo "6. Verificando configuração do Nginx..."
if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}✅ Configuração do Nginx está OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    nginx -t
    exit 1
fi
echo ""

echo "7. Iniciando Nginx..."
systemctl start nginx
sleep 2
echo ""

echo "8. Verificando status do Nginx..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando${NC}"
else
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    echo "   Logs de erro:"
    journalctl -u nginx -n 20 --no-pager
    exit 1
fi
echo ""

echo "9. Verificando se porta 80 está em uso pelo Nginx..."
if lsof -i :80 2>/dev/null | grep -q nginx; then
    echo -e "${GREEN}✅ Nginx está usando a porta 80${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx pode não estar usando a porta 80${NC}"
    lsof -i :80
fi
echo ""

echo "=========================================="
echo "  PRÓXIMOS PASSOS"
echo "=========================================="
echo ""
echo "Agora execute novamente o Certbot:"
echo "  certbot --nginx -d app.domseven.com.br"
echo ""
echo "Se ainda der erro, execute:"
echo "  1. systemctl status nginx"
echo "  2. journalctl -xeu nginx.service"
echo "  3. lsof -i :80"
echo ""

