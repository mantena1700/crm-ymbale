#!/bin/bash
# Script para parar Next.js da porta 80 e configurar corretamente
# Execute: bash corrigir-next-porta-80.sh

echo "=========================================="
echo "  CORRIGIR NEXT.JS NA PORTA 80"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Identificando processo next-server na porta 80..."
NEXT_PID=$(lsof -ti :80 2>/dev/null | head -1)

if [ ! -z "$NEXT_PID" ]; then
    echo "   PID encontrado: $NEXT_PID"
    ps aux | grep "$NEXT_PID" | grep -v grep
    echo ""
    
    echo "2. Parando processo next-server..."
    kill -9 "$NEXT_PID" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ Processo parado${NC}"
else
    echo -e "${YELLOW}⚠️  Processo next-server não encontrado na porta 80${NC}"
fi
echo ""

echo "3. Parando todos processos Node/Next..."
pkill -9 node 2>/dev/null || true
pkill -9 next-server 2>/dev/null || true
pm2 stop all 2>/dev/null || true
sleep 2
echo ""

echo "4. Verificando se porta 80 está livre..."
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 ainda está em uso${NC}"
    lsof -i :80
    echo ""
    echo "   Tentando parar todos processos..."
    fuser -k 80/tcp 2>/dev/null || true
    lsof -ti :80 | xargs kill -9 2>/dev/null || true
    sleep 3
else
    echo -e "${GREEN}✅ Porta 80 está livre${NC}"
fi
echo ""

echo "5. Verificando configuração do PM2..."
cd ~/crm-ymbale
if [ -f "ecosystem.config.js" ]; then
    echo "   Verificando PORT no ecosystem.config.js..."
    if grep -q "PORT: 3000" ecosystem.config.js; then
        echo -e "${GREEN}✅ PORT está configurado como 3000${NC}"
    else
        echo -e "${YELLOW}⚠️  PORT pode não estar como 3000${NC}"
        echo "   Conteúdo:"
        grep PORT ecosystem.config.js || echo "   PORT não encontrado"
    fi
else
    echo -e "${YELLOW}⚠️  ecosystem.config.js não encontrado${NC}"
fi
echo ""

echo "6. Verificando variáveis de ambiente..."
if [ -f ".env" ]; then
    if grep -q "PORT=80" .env; then
        echo -e "${RED}❌ PORT=80 encontrado no .env!${NC}"
        echo "   Isso está causando o problema!"
        echo ""
        echo "   Corrigindo .env..."
        sed -i 's/PORT=80/PORT=3000/g' .env
        sed -i 's/PORT = 80/PORT = 3000/g' .env
        echo -e "${GREEN}✅ .env corrigido${NC}"
    else
        echo -e "${GREEN}✅ PORT não está como 80 no .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env não encontrado${NC}"
fi
echo ""

echo "7. Garantindo que aplicação vai rodar na porta 3000..."
# Atualizar ecosystem.config.js para garantir PORT 3000
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
echo -e "${GREEN}✅ ecosystem.config.js atualizado (PORT: 3000)${NC}"
echo ""

echo "8. Iniciando aplicação na porta 3000..."
pm2 delete crm-ymbale 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
sleep 3
echo ""

echo "9. Verificando se aplicação está na porta 3000..."
if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}✅ Aplicação está rodando na porta 3000${NC}"
    curl -s http://localhost:3000 | head -5
else
    echo -e "${RED}❌ Aplicação não está na porta 3000${NC}"
    echo "   Verificando logs..."
    pm2 logs crm-ymbale --lines 10 --nostream
fi
echo ""

echo "10. Verificando se porta 80 está livre..."
if lsof -i :80 2>/dev/null | grep -q LISTEN; then
    echo -e "${RED}❌ Porta 80 ainda está em uso${NC}"
    lsof -i :80
else
    echo -e "${GREEN}✅ Porta 80 está livre!${NC}"
    echo ""
    echo "11. Iniciando Nginx..."
    systemctl start nginx
    sleep 2
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx iniciado com sucesso!${NC}"
    else
        echo -e "${RED}❌ Nginx não iniciou${NC}"
        journalctl -u nginx -n 10 --no-pager
    fi
fi
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo ""
echo "Status:"
pm2 status
echo ""
systemctl status nginx --no-pager | head -5
echo ""
echo "Portas:"
lsof -i :80 2>/dev/null || echo "Porta 80: livre"
lsof -i :3000 2>/dev/null || echo "Porta 3000: livre"
echo ""
echo "Próximos passos:"
echo "  1. Testar: curl http://localhost (deve passar pelo Nginx)"
echo "  2. Testar: curl http://localhost:3000 (deve acessar Next.js direto)"
echo "  3. Executar Certbot: certbot --nginx -d app.domseven.com.br"
echo ""

