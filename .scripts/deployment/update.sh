#!/bin/bash

# Script para atualizar VPS forçando sobrescrever mudanças locais
echo "🔄 Atualizando VPS com código mais recente..."

cd ~/crm-ymbale || exit 1

# Parar servidor
echo "🛑 Parando servidor..."
pm2 stop crm-ymbale

# Descartar mudanças locais e atualizar
echo "📥 Descartando mudanças locais e atualizando código..."
git fetch origin
git reset --hard origin/main

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Regenerar Prisma Client
echo "🔧 Regenerando Prisma Client..."
npx prisma generate

# Reconstruir aplicação
echo "🏗️ Reconstruindo aplicação..."
rm -rf .next
npm run build

# Reiniciar servidor
echo "🚀 Reiniciando servidor..."
pm2 restart crm-ymbale

# Mostrar logs
echo "📋 Últimos logs:"
pm2 logs crm-ymbale --lines 30

echo "✅ Atualização concluída!"

