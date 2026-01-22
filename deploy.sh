#!/bin/bash

# Script de Deploy Automático para VPS
# Uso: ./deploy.sh

echo "🚀 Iniciando Deploy do CRM Ymbale..."

# 1. Puxar alterações do git
echo "📥 1. Baixando atualizações do repositório..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Erro ao baixar atualizações. Verifique se há conflitos locais."
    exit 1
fi

# 2. Instalar dependências (caso haja novas)
echo "📦 2. Atualizando dependências..."
npm install

# 3. Gerar Prisma Client (garantia de estar atualizado)
echo "🗄️ 3. Regenerando Prisma Client..."
npx prisma generate

# 4. Build da aplicação Next.js
echo "🏗️ 4. Construindo aplicação (Build)..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erro no Build. O deploy foi abortado para não quebrar o site atual."
    exit 1
fi

# 5. Reiniciar aplicação no PM2
echo "🔄 5. Reiniciando servidor..."

# Verifica se o processo existe no PM2
if pm2 list | grep -q "crm-ymbale"; then
    pm2 restart crm-ymbale
    echo "✅ Processo 'crm-ymbale' reiniciado."
else
    echo "⚠️ Processo 'crm-ymbale' não encontrado no PM2."
    echo "Tentando reiniciar todos os processos..."
    pm2 restart all
fi

echo "✅ Deploy concluído com sucesso! 🚀"
