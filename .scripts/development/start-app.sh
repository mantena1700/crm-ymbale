#!/bin/bash
# Script para iniciar a aplicação após build
# Execute: bash iniciar-aplicacao.sh

cd ~/crm-ymbale

echo "=========================================="
echo "  INICIAR APLICAÇÃO - CRM YMBALE"
echo "=========================================="
echo ""

# 1. Parar TUDO do PM2
echo "1. Parando todos os processos PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
echo "✅ PM2 limpo"

# 2. Matar qualquer processo na porta 3000
echo ""
echo "2. Liberando porta 3000..."
if command -v lsof &> /dev/null; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    echo "✅ Porta 3000 liberada (lsof)"
else
    echo "⚠️  lsof não encontrado, tentando fuser..."
fi

# Tentar com fuser também
if command -v fuser &> /dev/null; then
    fuser -k 3000/tcp 2>/dev/null || true
    echo "✅ Porta 3000 liberada (fuser)"
fi

# 3. Verificar se liberou
echo ""
echo "3. Verificando porta 3000..."
if lsof -i:3000 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Ainda há processo na porta 3000"
    lsof -i:3000
else
    echo "✅ Porta 3000 está livre"
fi

# 4. Iniciar aplicação
echo ""
echo "4. Iniciando aplicação..."

# Verificar se ecosystem.config.js existe
if [ -f "ecosystem.config.js" ]; then
    echo "   Usando ecosystem.config.js..."
    pm2 start ecosystem.config.js
else
    echo "   Iniciando com npm start..."
    pm2 start npm --name "crm-ymbale" -- start
fi

pm2 save
echo "✅ Aplicação iniciada"

# 5. Verificar status
echo ""
echo "5. Verificando status..."
pm2 status

echo ""
echo "6. Últimas linhas dos logs..."
sleep 2
pm2 logs crm-ymbale --lines 20 --nostream 2>/dev/null || pm2 logs --lines 20 --nostream

echo ""
echo "=========================================="
echo "  ✅ APLICAÇÃO INICIADA!"
echo "=========================================="
echo ""
echo "Comandos úteis:"
echo "  - Ver status: pm2 status"
echo "  - Ver logs: pm2 logs crm-ymbale --lines 50"
echo "  - Reiniciar: pm2 restart crm-ymbale"
echo ""

