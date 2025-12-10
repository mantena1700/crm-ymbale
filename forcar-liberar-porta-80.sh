#!/bin/bash
# Script para FORÇAR liberação da porta 80
# Execute: bash forcar-liberar-porta-80.sh

echo "=========================================="
echo "  FORÇAR LIBERAÇÃO DA PORTA 80"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Identificando TODOS os processos na porta 80..."
echo "------------------------------------------"

# Tentar todos os métodos
if command -v lsof &> /dev/null; then
    echo "   Usando lsof:"
    lsof -i :80
    PIDS=$(lsof -ti :80 2>/dev/null)
fi

if command -v netstat &> /dev/null; then
    echo ""
    echo "   Usando netstat:"
    netstat -tulpn | grep :80
    PIDS_NETSTAT=$(netstat -tulpn | grep :80 | awk '{print $7}' | cut -d'/' -f1 | grep -E '^[0-9]+$')
    if [ ! -z "$PIDS_NETSTAT" ]; then
        PIDS="$PIDS $PIDS_NETSTAT"
    fi
fi

if command -v ss &> /dev/null; then
    echo ""
    echo "   Usando ss:"
    ss -tulpn | grep :80
fi

if command -v fuser &> /dev/null; then
    echo ""
    echo "   Usando fuser:"
    fuser 80/tcp 2>/dev/null
    FUSER_PID=$(fuser 80/tcp 2>/dev/null | awk '{print $1}')
    if [ ! -z "$FUSER_PID" ]; then
        PIDS="$PIDS $FUSER_PID"
    fi
fi

echo ""
echo "2. Parando TODOS os processos identificados..."
echo "------------------------------------------"

# Remover duplicatas e espaços
PIDS=$(echo $PIDS | tr ' ' '\n' | sort -u | tr '\n' ' ')

if [ ! -z "$PIDS" ]; then
    for PID in $PIDS; do
        if [ ! -z "$PID" ] && [ "$PID" != "-" ]; then
            echo "   Parando processo $PID..."
            ps aux | grep "^[^ ]* *$PID " | grep -v grep
            kill -9 "$PID" 2>/dev/null || true
        fi
    done
    sleep 2
fi

echo ""
echo "3. Parando TODOS processos Node/Next/PM2..."
echo "------------------------------------------"
pkill -9 node 2>/dev/null || true
pkill -9 next-server 2>/dev/null || true
pkill -9 npm 2>/dev/null || true
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
sleep 3
echo ""

echo "4. Forçando liberação da porta 80..."
echo "------------------------------------------"
if command -v fuser &> /dev/null; then
    fuser -k 80/tcp 2>/dev/null || true
fi

# Tentar novamente com lsof
if command -v lsof &> /dev/null; then
    lsof -ti :80 | xargs kill -9 2>/dev/null || true
fi

sleep 3
echo ""

echo "5. Verificando se porta 80 está livre..."
echo "------------------------------------------"
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 AINDA está em uso!${NC}"
    echo ""
    echo "   Processos restantes:"
    lsof -i :80
    echo ""
    echo "   Tentando método mais agressivo..."
    
    # Listar todos processos e parar manualmente
    ALL_PIDS=$(lsof -ti :80 2>/dev/null)
    for PID in $ALL_PIDS; do
        echo "   Forçando parada do processo $PID..."
        kill -9 "$PID" 2>/dev/null || true
    done
    
    sleep 5
    
    if lsof -i :80 2>/dev/null | grep -q LISTEN; then
        echo -e "${RED}❌ Não foi possível liberar a porta 80${NC}"
        echo ""
        echo "   Processos teimosos:"
        lsof -i :80
        echo ""
        echo "   Pode ser necessário reiniciar o servidor ou verificar"
        echo "   se há um serviço systemd usando a porta 80"
        echo ""
        echo "   Verificar serviços:"
        systemctl list-units | grep -E "nginx|apache|httpd|web"
        exit 1
    else
        echo -e "${GREEN}✅ Porta 80 liberada após método agressivo${NC}"
    fi
else
    echo -e "${GREEN}✅ Porta 80 está livre!${NC}"
fi
echo ""

echo "6. Verificando se aplicação está na porta 3000..."
echo "------------------------------------------"
cd ~/crm-ymbale

# Garantir que ecosystem.config.js tem PORT 3000
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

# Verificar .env
if [ -f ".env" ]; then
    if grep -q "PORT=80" .env; then
        echo "   Corrigindo PORT no .env..."
        sed -i 's/PORT=80/PORT=3000/g' .env
        sed -i 's/PORT = 80/PORT = 3000/g' .env
    fi
fi

# Iniciar aplicação
pm2 start ecosystem.config.js
pm2 save
sleep 3

if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✅ Aplicação está na porta 3000${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação pode não estar na porta 3000${NC}"
    pm2 logs crm-ymbale --lines 5 --nostream
fi
echo ""

echo "7. Iniciando Nginx..."
echo "------------------------------------------"
systemctl start nginx
sleep 2

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx iniciado com sucesso!${NC}"
else
    echo -e "${RED}❌ Nginx não iniciou${NC}"
    echo "   Logs:"
    journalctl -u nginx -n 10 --no-pager
    exit 1
fi
echo ""

echo "8. Verificação final..."
echo "------------------------------------------"
echo "Porta 80:"
lsof -i :80 | grep nginx || echo "   Nginx não encontrado na porta 80"
echo ""
echo "Porta 3000:"
lsof -i :3000 | grep node || echo "   Node não encontrado na porta 3000"
echo ""

echo "=========================================="
echo "  SUCESSO!"
echo "=========================================="
echo ""
echo "Teste:"
echo "  curl http://localhost        # Via Nginx"
echo "  curl http://localhost:3000   # Direto Next.js"
echo ""
echo "Agora execute:"
echo "  certbot --nginx -d app.domseven.com.br"
echo ""

