#!/bin/bash

# Script para diagnosticar crash do servidor
echo "🔍 Diagnosticando crash do servidor..."

cd ~/crm-ymbale || exit 1

# Parar PM2
echo "🛑 Parando PM2..."
pm2 stop all
pm2 delete all

# Verificar erros de sintaxe TypeScript
echo "📝 Verificando erros de sintaxe..."
npx tsc --noEmit --skipLibCheck 2>&1 | head -50

# Verificar se o build funciona
echo "🏗️ Testando build..."
npm run build 2>&1 | tail -100

# Verificar logs de erro
echo "📋 Últimos erros do PM2:"
pm2 logs --err --lines 50 2>&1 || echo "Nenhum log de erro encontrado"

echo "✅ Diagnóstico concluído!"

