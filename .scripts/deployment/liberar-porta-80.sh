#!/bin/bash
# Script para liberar porta 80 e iniciar Nginx
# Execute: bash liberar-porta-80.sh

echo "=========================================="
echo "  LIBERAR PORTA 80 E INICIAR NGINX"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Identificando processo na porta 80..."
echo "------------------------------------------"

# Tentar diferentes métodos para encontrar processo
if command -v lsof &> /dev/null; then
    PORT_PROCESS=$(lsof -i :80 2>/dev/null)
elif command -v netstat &> /dev/null; then
    PORT_PROCESS=$(netstat -tulpn | grep :80)
elif command -v ss &> /dev/null; then
    PORT_PROCESS=$(ss -tulpn | grep :80)
else
    PORT_PROCESS=""
fi

if [ -z "$PORT_PROCESS" ]; then
    echo -e "${YELLOW}⚠️  Não foi possível identificar processo com métodos padrão${NC}"
    echo "   Tentando método alternativo..."
    
    # Usar fuser
    if command -v fuser &> /dev/null; then
        echo "   Usando fuser..."
        fuser 80/tcp 2>/dev/null
        FUSER_PID=$(fuser 80/tcp 2>/dev/null | awk '{print $1}')
        if [ ! -z "$FUSER_PID" ]; then
            echo "   PID encontrado: $FUSER_PID"
            PORT_PROCESS="PID: $FUSER_PID"
        fi
    fi
else
    echo "$PORT_PROCESS"
    echo ""
    
    # Extrair PID
    if command -v lsof &> /dev/null; then
        PID=$(lsof -ti :80 2>/dev/null | head -1)
    elif command -v netstat &> /dev/null; then
        PID=$(netstat -tulpn | grep :80 | awk '{print $7}' | cut -d'/' -f1 | head -1)
    elif command -v ss &> /dev/null; then
        PID=$(ss -tulpn | grep :80 | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2 | head -1)
    fi
    
    if [ ! -z "$PID" ] && [ "$PID" != "-" ]; then
        echo "   PID encontrado: $PID"
        echo ""
        echo "2. Verificando processo..."
        ps aux | grep "$PID" | grep -v grep
        echo ""
        
        echo "3. Parando processo..."
        kill -9 "$PID" 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}✅ Processo parado${NC}"
    fi
fi
echo ""

echo "4. Parando todos processos Nginx..."
pkill -9 nginx 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
sleep 2
echo ""

echo "5. Verificando se porta 80 está livre..."
sleep 1
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 ainda está em uso${NC}"
    echo "   Tentando método mais agressivo..."
    
    # Parar todos processos na porta 80
    if command -v fuser &> /dev/null; then
        fuser -k 80/tcp 2>/dev/null || true
    fi
    
    # Tentar novamente com lsof
    if command -v lsof &> /dev/null; then
        lsof -ti :80 | xargs kill -9 2>/dev/null || true
    fi
    
    sleep 3
    
    if lsof -i :80 2>/dev/null | grep -q LISTEN; then
        echo -e "${RED}❌ Não foi possível liberar a porta 80${NC}"
        echo "   Processos ainda rodando:"
        lsof -i :80
        echo ""
        echo "   Tente parar manualmente ou reinicie o servidor"
        exit 1
    else
        echo -e "${GREEN}✅ Porta 80 liberada${NC}"
    fi
else
    echo -e "${GREEN}✅ Porta 80 está livre${NC}"
fi
echo ""

echo "6. Verificando configuração do Nginx..."
if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}✅ Configuração OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    nginx -t
    exit 1
fi
echo ""

echo "7. Iniciando Nginx..."
systemctl start nginx
sleep 2
echo ""

echo "8. Verificando status..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando!${NC}"
    echo ""
    echo "   Status:"
    systemctl status nginx --no-pager | head -5
    echo ""
    echo "   Porta 80:"
    lsof -i :80 | grep nginx || netstat -tulpn | grep :80 | grep nginx
else
    echo -e "${RED}❌ Nginx não iniciou${NC}"
    echo "   Logs:"
    journalctl -u nginx -n 10 --no-pager
    exit 1
fi
echo ""

echo "=========================================="
echo "  SUCESSO!"
echo "=========================================="
echo ""
echo "Nginx está rodando na porta 80!"
echo ""
echo "Próximos passos:"
echo "  1. Testar: curl http://localhost"
echo "  2. Executar Certbot: certbot --nginx -d app.domseven.com.br"
echo ""

