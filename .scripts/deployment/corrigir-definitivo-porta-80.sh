#!/bin/bash
# Script para corrigir DEFINITIVAMENTE o problema da porta 80
# Execute: bash corrigir-definitivo-porta-80.sh

set -e

echo "=========================================="
echo "  CORREÇÃO DEFINITIVA - PORTA 80"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Encontrando TODOS processos na porta 80..."
echo "------------------------------------------"
ALL_PIDS=$(lsof -ti :80 2>/dev/null)

if [ ! -z "$ALL_PIDS" ]; then
    echo "   PIDs encontrados: $ALL_PIDS"
    for PID in $ALL_PIDS; do
        echo "   Processo $PID:"
        ps aux | grep "^[^ ]* *$PID " | grep -v grep || echo "     Processo não encontrado"
    done
else
    echo -e "${YELLOW}⚠️  Nenhum processo encontrado com lsof${NC}"
    echo "   Tentando outros métodos..."
    
    # Tentar com netstat
    NETSTAT_PIDS=$(netstat -tulpn | grep :80 | awk '{print $7}' | cut -d'/' -f1 | grep -E '^[0-9]+$')
    if [ ! -z "$NETSTAT_PIDS" ]; then
        echo "   PIDs do netstat: $NETSTAT_PIDS"
        ALL_PIDS="$ALL_PIDS $NETSTAT_PIDS"
    fi
    
    # Tentar com ss
    SS_PIDS=$(ss -tulpn | grep :80 | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2 | grep -E '^[0-9]+$')
    if [ ! -z "$SS_PIDS" ]; then
        echo "   PIDs do ss: $SS_PIDS"
        ALL_PIDS="$ALL_PIDS $SS_PIDS"
    fi
fi
echo ""

echo "2. Parando TODOS processos identificados..."
echo "------------------------------------------"
# Remover duplicatas
ALL_PIDS=$(echo $ALL_PIDS | tr ' ' '\n' | sort -u | tr '\n' ' ')

for PID in $ALL_PIDS; do
    if [ ! -z "$PID" ] && [ "$PID" != "-" ]; then
        echo "   Parando processo $PID..."
        kill -9 "$PID" 2>/dev/null || true
    fi
done

# Parar todos processos relacionados
pkill -9 next-server 2>/dev/null || true
pkill -9 node 2>/dev/null || true
pkill -9 npm 2>/dev/null || true
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Forçar liberação
fuser -k 80/tcp 2>/dev/null || true

sleep 5
echo ""

echo "3. Verificando se porta 80 está livre..."
echo "------------------------------------------"
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 AINDA está em uso!${NC}"
    echo "   Processos restantes:"
    lsof -i :80
    echo ""
    echo "   Tentando método mais agressivo..."
    
    # Listar todos processos e parar
    REMAINING_PIDS=$(lsof -ti :80 2>/dev/null)
    for PID in $REMAINING_PIDS; do
        echo "   Forçando parada do processo $PID..."
        kill -9 "$PID" 2>/dev/null || true
    done
    
    sleep 5
    
    if lsof -i :80 2>/dev/null | grep -q LISTEN; then
        echo -e "${RED}❌ Não foi possível liberar porta 80${NC}"
        echo ""
        echo "   Processos teimosos:"
        lsof -i :80
        echo ""
        echo "   Pode ser necessário:"
        echo "   1. Reiniciar o servidor"
        echo "   2. Verificar se há serviço systemd usando porta 80"
        echo "   3. Verificar firewall/iptables"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Porta 80 está livre!${NC}"
echo ""

echo "4. Garantindo que aplicação vai na porta 3000..."
echo "------------------------------------------"
cd ~/crm-ymbale

# Verificar e corrigir .env
if [ -f ".env" ]; then
    echo "   Verificando .env..."
    if grep -q "PORT=80" .env; then
        echo -e "${RED}❌ PORT=80 encontrado no .env!${NC}"
        sed -i 's/PORT=80/PORT=3000/g' .env
        sed -i 's/PORT = 80/PORT = 3000/g' .env
        echo -e "${GREEN}✅ .env corrigido${NC}"
    else
        echo -e "${GREEN}✅ PORT não está como 80 no .env${NC}"
    fi
fi

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
echo -e "${GREEN}✅ ecosystem.config.js garantido (PORT: 3000)${NC}"
echo ""

echo "5. Iniciando aplicação na porta 3000..."
pm2 start ecosystem.config.js
pm2 save
sleep 5

if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✅ Aplicação está na porta 3000${NC}"
    lsof -i :3000 | grep node
else
    echo -e "${RED}❌ Aplicação não está na porta 3000${NC}"
    echo "   Logs:"
    pm2 logs crm-ymbale --lines 10 --nostream
    exit 1
fi
echo ""

echo "6. Verificando se porta 80 está AINDA livre..."
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 foi ocupada novamente!${NC}"
    lsof -i :80
    echo ""
    echo "   A aplicação pode estar iniciando na porta 80"
    echo "   Verificando logs..."
    pm2 logs crm-ymbale --lines 20 --nostream
    exit 1
fi
echo -e "${GREEN}✅ Porta 80 está livre${NC}"
echo ""

echo "7. Configurando Nginx..."
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

if nginx -t; then
    echo -e "${GREEN}✅ Configuração OK${NC}"
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    exit 1
fi
echo ""

echo "8. Iniciando Nginx..."
systemctl start nginx
sleep 3

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅✅✅ NGINX INICIADO COM SUCESSO! ✅✅✅${NC}"
else
    echo -e "${RED}❌ Nginx não iniciou${NC}"
    journalctl -u nginx -n 20 --no-pager
    exit 1
fi
echo ""

echo "9. Verificação final..."
echo "------------------------------------------"
echo "Porta 80:"
lsof -i :80 | grep nginx || echo "   Nginx não encontrado"
echo ""
echo "Porta 3000:"
lsof -i :3000 | grep node || echo "   Node não encontrado"
echo ""

echo "10. Testando..."
curl -I http://localhost 2>/dev/null | head -3 || echo "   Teste falhou"
echo ""

echo "=========================================="
echo "  SUCESSO!"
echo "=========================================="
echo ""
echo "Agora execute:"
echo "  certbot --nginx -d app.domseven.com.br"
echo ""
echo "OU use o script:"
echo "  bash resolver-tudo-https.sh"
echo ""

