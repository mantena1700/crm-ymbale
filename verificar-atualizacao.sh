#!/bin/bash
# Script para verificar se a atualização foi aplicada
# Execute: bash verificar-atualizacao.sh

echo "=========================================="
echo "  VERIFICAR ATUALIZAÇÃO - VPS"
echo "=========================================="
echo ""

cd ~/crm-ymbale

echo "1. Verificando versão do Git..."
echo "------------------------------------------"
git log -1 --oneline
echo ""
git status
echo ""

echo "2. Verificando arquivos mobile criados..."
echo "------------------------------------------"
echo "Service Worker:"
ls -la public/sw.js 2>/dev/null && echo "✅ sw.js existe" || echo "❌ sw.js NÃO existe"
echo ""

echo "Mobile Optimizations CSS:"
ls -la src/app/mobile-optimizations.css 2>/dev/null && echo "✅ mobile-optimizations.css existe" || echo "❌ mobile-optimizations.css NÃO existe"
echo ""

echo "ServiceWorkerRegistration:"
ls -la src/components/ServiceWorkerRegistration.tsx 2>/dev/null && echo "✅ ServiceWorkerRegistration.tsx existe" || echo "❌ ServiceWorkerRegistration.tsx NÃO existe"
echo ""

echo "MobileOptimizations:"
ls -la src/components/MobileOptimizations.tsx 2>/dev/null && echo "✅ MobileOptimizations.tsx existe" || echo "❌ MobileOptimizations.tsx NÃO existe"
echo ""

echo "3. Verificando se está no build..."
echo "------------------------------------------"
if [ -d ".next" ]; then
    echo "✅ Diretório .next existe"
    
    if [ -f ".next/static/chunks/app/layout.js" ] || [ -f ".next/static/chunks/app/layout-*.js" ]; then
        echo "✅ Build do layout existe"
        
        # Verificar se Service Worker está sendo servido
        if grep -q "sw.js\|ServiceWorkerRegistration" .next/static/chunks/app/layout*.js 2>/dev/null; then
            echo "✅ Service Worker está no build"
        else
            echo "⚠️  Service Worker pode não estar no build"
        fi
    else
        echo "❌ Build não encontrado - execute: npm run build"
    fi
else
    echo "❌ Diretório .next não existe - execute: npm run build"
fi
echo ""

echo "4. Verificando manifest.json..."
echo "------------------------------------------"
if [ -f "public/manifest.json" ]; then
    echo "✅ manifest.json existe"
    cat public/manifest.json | grep -E "shortcuts|display" || echo "⚠️  Manifest pode estar desatualizado"
else
    echo "❌ manifest.json NÃO existe"
fi
echo ""

echo "5. Verificando PM2..."
echo "------------------------------------------"
pm2 list | grep crm-ymbale || echo "⚠️  Aplicação não está rodando no PM2"
echo ""

echo "6. Verificando porta 3000..."
echo "------------------------------------------"
if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo "✅ Aplicação está rodando na porta 3000"
    lsof -i :3000 | head -2
else
    echo "❌ Nenhuma aplicação na porta 3000"
fi
echo ""

echo "7. Testando Service Worker..."
echo "------------------------------------------"
if curl -s http://localhost:3000/sw.js | head -5; then
    echo "✅ Service Worker está acessível"
else
    echo "❌ Service Worker NÃO está acessível"
fi
echo ""

echo "8. Verificando se arquivos foram commitados no Git..."
echo "------------------------------------------"
git ls-files | grep -E "sw.js|mobile-optimizations|ServiceWorkerRegistration|MobileOptimizations" | head -10
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo ""
echo "Se algum arquivo estiver faltando:"
echo "  1. Execute: bash atualizar-simples.sh"
echo "  2. Ou faça commit e push dos arquivos novos"
echo ""

