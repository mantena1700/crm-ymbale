#!/bin/bash
# Script para limpar processos fantasmas
# Execute: bash limpar-processos-fantasma.sh

echo "=========================================="
echo "  LIMPAR PROCESSOS FANTASMA"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Identificando processos na porta 80..."
echo "------------------------------------------"
PORT_80_PIDS=$(lsof -ti :80 2>/dev/null)

if [ ! -z "$PORT_80_PIDS" ]; then
    echo "   PIDs encontrados: $PORT_80_PIDS"
    echo ""
    
    for PID in $PORT_80_PIDS; do
        echo "   Processo $PID:"
        ps aux | grep "^[^ ]* *$PID " | grep -v grep || echo "     Não encontrado"
        
        # Verificar se é Next.js
        if ps aux | grep "^[^ ]* *$PID " | grep -q "next-server\|node.*next"; then
            echo -e "${RED}   ⚠️  Este é um processo Next.js FANTASMA na porta 80!${NC}"
            echo "   Parando..."
            kill -9 "$PID" 2>/dev/null || true
            echo -e "${GREEN}   ✅ Processo $PID parado${NC}"
        elif ps aux | grep "^[^ ]* *$PID " | grep -q "nginx"; then
            echo -e "${GREEN}   ✅ Este é o Nginx (correto)${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Processo desconhecido na porta 80${NC}"
            echo "   Parando por segurança..."
            kill -9 "$PID" 2>/dev/null || true
        fi
        echo ""
    done
else
    echo -e "${GREEN}✅ Nenhum processo na porta 80${NC}"
fi
echo ""

echo "2. Parando processos Next.js fora do PM2..."
echo "------------------------------------------"
# Parar processos next-server que não estão no PM2
pkill -9 next-server 2>/dev/null || true

# Verificar se há processos Node rodando diretamente (não via PM2)
NODE_PROCS=$(ps aux | grep -E "node.*next|node.*server" | grep -v grep | grep -v pm2 | awk '{print $2}')
if [ ! -z "$NODE_PROCS" ]; then
    echo "   Processos Node encontrados fora do PM2:"
    for PID in $NODE_PROCS; do
        echo "   - PID $PID:"
        ps aux | grep "^[^ ]* *$PID " | grep -v grep
        kill -9 "$PID" 2>/dev/null || true
    done
    echo -e "${GREEN}✅ Processos parados${NC}"
else
    echo -e "${GREEN}✅ Nenhum processo Node fora do PM2${NC}"
fi
echo ""

echo "3. Verificando se porta 80 está livre..."
echo "------------------------------------------"
sleep 2
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 ainda está em uso${NC}"
    lsof -i :80
    echo ""
    echo "   Tentando método mais agressivo..."
    fuser -k 80/tcp 2>/dev/null || true
    lsof -ti :80 | xargs kill -9 2>/dev/null || true
    sleep 3
    
    if lsof -i :80 2>/dev/null | grep -q LISTEN; then
        echo -e "${RED}❌ Não foi possível liberar porta 80${NC}"
        echo "   Processos restantes:"
        lsof -i :80
        exit 1
    fi
fi
echo -e "${GREEN}✅ Porta 80 está livre!${NC}"
echo ""

echo "4. Verificando aplicação no PM2..."
echo "------------------------------------------"
cd ~/crm-ymbale

if pm2 list | grep -q "crm-ymbale.*online"; then
    echo -e "${GREEN}✅ Aplicação está rodando no PM2${NC}"
    
    # Verificar se está na porta 3000
    if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
        echo -e "${GREEN}✅ Aplicação está na porta 3000 (correto)${NC}"
    else
        echo -e "${YELLOW}⚠️  Aplicação pode não estar na porta 3000${NC}"
        echo "   Reiniciando..."
        pm2 restart crm-ymbale
        sleep 3
    fi
else
    echo -e "${YELLOW}⚠️  Aplicação não está rodando no PM2${NC}"
    echo "   Iniciando..."
    
    # Garantir ecosystem.config.js
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
    
    pm2 start ecosystem.config.js
    pm2 save
    sleep 3
fi
echo ""

echo "5. Verificação final..."
echo "------------------------------------------"
echo "Porta 80:"
lsof -i :80 2>/dev/null || echo "   ✅ Livre"
echo ""
echo "Porta 3000:"
lsof -i :3000 2>/dev/null || echo "   ⚠️  Nenhum processo"
echo ""
echo "PM2:"
pm2 list
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Processos fantasmas limpos!${NC}"
echo ""
echo "Agora você pode:"
echo "  1. Iniciar Nginx: systemctl start nginx"
echo "  2. Configurar SSL: certbot --nginx -d app.domseven.com.br"
echo ""

