#!/bin/bash
# Script para verificar e limpar processos fantasmas
# Execute: bash verificar-processos-fantasma.sh

echo "=========================================="
echo "  VERIFICAR E LIMPAR PROCESSOS FANTASMA"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Verificando processos na porta 80..."
echo "------------------------------------------"
PORT_80=$(lsof -i :80 2>/dev/null)
if [ ! -z "$PORT_80" ]; then
    echo -e "${RED}❌ Processos encontrados na porta 80:${NC}"
    echo "$PORT_80"
    echo ""
    
    # Extrair PIDs
    PIDS=$(echo "$PORT_80" | awk 'NR>1 {print $2}' | sort -u)
    for PID in $PIDS; do
        if [ ! -z "$PID" ]; then
            echo "   Processo $PID:"
            ps aux | grep "^[^ ]* *$PID " | grep -v grep || echo "     Não encontrado"
            
            # Verificar se é processo Next.js
            if ps aux | grep "^[^ ]* *$PID " | grep -q "next-server\|node.*next"; then
                echo -e "${RED}   ⚠️  Este é um processo Next.js na porta 80 (FANTASMA!)${NC}"
                echo "   Deve estar na porta 3000, não na 80!"
            fi
        fi
    done
else
    echo -e "${GREEN}✅ Porta 80 está livre${NC}"
fi
echo ""

echo "2. Verificando processos na porta 3000..."
echo "------------------------------------------"
PORT_3000=$(lsof -i :3000 2>/dev/null)
if [ ! -z "$PORT_3000" ]; then
    echo -e "${GREEN}✅ Processos encontrados na porta 3000:${NC}"
    echo "$PORT_3000"
else
    echo -e "${YELLOW}⚠️  Nenhum processo na porta 3000${NC}"
    echo "   A aplicação pode não estar rodando"
fi
echo ""

echo "3. Verificando processos PM2..."
echo "------------------------------------------"
if command -v pm2 &> /dev/null; then
    pm2 list
    PM2_COUNT=$(pm2 list | grep -c "online" || echo "0")
    if [ "$PM2_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ $PM2_COUNT processo(s) rodando no PM2${NC}"
    else
        echo -e "${YELLOW}⚠️  Nenhum processo rodando no PM2${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 não encontrado${NC}"
fi
echo ""

echo "4. Verificando processos Node/Next fora do PM2..."
echo "------------------------------------------"
NODE_PROCS=$(ps aux | grep -E "node|next-server|npm" | grep -v grep | grep -v pm2)
if [ ! -z "$NODE_PROCS" ]; then
    echo -e "${YELLOW}⚠️  Processos Node/Next encontrados fora do PM2:${NC}"
    echo "$NODE_PROCS"
    echo ""
    echo "   Estes podem ser processos 'fantasma'!"
else
    echo -e "${GREEN}✅ Nenhum processo Node/Next fora do PM2${NC}"
fi
echo ""

echo "5. Resumo e Recomendações..."
echo "------------------------------------------"
if [ ! -z "$PORT_80" ] && echo "$PORT_80" | grep -q "next-server\|node"; then
    echo -e "${RED}❌ PROBLEMA ENCONTRADO!${NC}"
    echo ""
    echo "   Há um processo Next.js na porta 80!"
    echo "   Isso está bloqueando o Nginx."
    echo ""
    echo "   Solução:"
    echo "   1. Identifique o PID do processo na porta 80"
    echo "   2. Execute: kill -9 PID"
    echo "   3. Verifique: lsof -i :80"
    echo "   4. Inicie Nginx: systemctl start nginx"
    echo ""
    echo "   OU execute:"
    echo "   bash limpar-processos-fantasma.sh"
else
    echo -e "${GREEN}✅ Tudo parece estar correto!${NC}"
    echo ""
    echo "   Arquitetura:"
    echo "   - Porta 80: Nginx (ou livre)"
    echo "   - Porta 3000: Next.js (PM2)"
    echo "   - Porta 443: Nginx HTTPS (após configurar SSL)"
fi
echo ""

echo "=========================================="

