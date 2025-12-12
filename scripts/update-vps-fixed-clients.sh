#!/bin/bash

# Script para atualizar VPS com funcionalidade de clientes fixos e seleção múltipla
# Execute: bash scripts/update-vps-fixed-clients.sh

cd ~/crm-ymbale

echo "🔄 Atualizando repositório..."
git pull origin main

echo ""
echo "⏹️  Parando aplicação..."
pm2 stop crm-ymbale

echo ""
echo "📋 Verificando schema do Prisma..."
cat prisma/schema.prisma | grep -A 20 "model FixedClient"

echo ""
echo "🔧 Regenerando Prisma Client..."
npx prisma generate

echo ""
echo "🗄️  Verificando/atualizando banco de dados..."
# Verificar se a tabela fixed_clients existe, se não, criar
npx prisma db push

echo ""
echo "🏗️  Rebuildando aplicação..."
npm run build

echo ""
echo "▶️  Reiniciando aplicação..."
pm2 restart crm-ymbale

echo ""
echo "✅ Atualização concluída!"
echo ""
echo "📊 Verificando logs..."
pm2 logs crm-ymbale --lines 20

