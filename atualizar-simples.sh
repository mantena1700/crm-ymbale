#!/bin/bash
# Script SIMPLES de atualização - sem verificações complexas
# Execute: bash atualizar-simples.sh

cd ~/crm-ymbale

echo "1. Resetando Git..."
git fetch origin main
git reset --hard origin/main
git clean -fd

echo ""
echo "2. Instalando dependências..."
npm install

echo ""
echo "3. Atualizando Prisma..."
npx prisma generate
npx prisma db push

echo ""
echo "4. Fazendo build..."
npm run build

echo ""
echo "5. Copiando arquivos estáticos..."
cp -r public .next/standalone/ 2>/dev/null || true
mkdir -p .next/standalone/.next 2>/dev/null || true
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true

echo ""
echo "6. Reiniciando aplicação..."
pm2 stop crm-ymbale 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "✅ CONCLUÍDO!"
pm2 status

