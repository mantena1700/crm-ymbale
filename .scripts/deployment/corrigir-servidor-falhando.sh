#!/bin/bash
# Script para corrigir erro "Failed to start server"
# Execute na VPS: bash corrigir-servidor-falhando.sh

set -e

echo "=========================================="
echo "  CORREÇÃO: SERVIDOR FALHANDO"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: Não está no diretório do projeto${NC}"
    echo "Execute: cd ~/crm-ymbale"
    exit 1
fi

PROJECT_DIR=$(pwd)
echo -e "${GREEN}✅ Diretório: $PROJECT_DIR${NC}"
echo ""

# 1. Parar aplicação completamente
echo "1. Parando aplicação..."
pm2 stop crm-ymbale 2>/dev/null || true
pm2 delete crm-ymbale 2>/dev/null || true
echo -e "${GREEN}✅ Aplicação parada${NC}"
echo ""

# 2. Limpar build anterior completamente
echo "2. Limpando build anterior..."
rm -rf .next
echo -e "${GREEN}✅ Build limpo${NC}"
echo ""

# 3. Limpar node_modules e reinstalar (opcional, mas recomendado)
echo "3. Reinstalando dependências..."
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"
echo ""

# 4. Atualizar Prisma
echo "4. Atualizando Prisma..."
npx prisma generate
npx prisma db push
echo -e "${GREEN}✅ Prisma atualizado${NC}"
echo ""

# 5. Rebuild completo
echo "5. Fazendo rebuild completo..."
npm run build
echo -e "${GREEN}✅ Build concluído${NC}"
echo ""

# 6. Verificar se standalone foi criado
echo "6. Verificando standalone..."
if [ ! -d ".next/standalone" ]; then
    echo -e "${RED}❌ ERRO: Standalone não foi criado!${NC}"
    echo "   Verifique se next.config.ts tem output: 'standalone'"
    exit 1
fi
echo -e "${GREEN}✅ Standalone encontrado${NC}"
echo ""

# 7. Copiar arquivos estáticos (CRÍTICO!)
echo "7. Copiando arquivos estáticos..."
if [ -d "public" ]; then
    cp -r public .next/standalone/ 2>/dev/null || true
    echo -e "${GREEN}✅ Arquivos públicos copiados${NC}"
else
    echo -e "${YELLOW}⚠️  Diretório public não encontrado${NC}"
fi

if [ -d ".next/static" ]; then
    mkdir -p .next/standalone/.next 2>/dev/null || true
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
    echo -e "${GREEN}✅ Arquivos estáticos (.next/static) copiados${NC}"
else
    echo -e "${RED}❌ ERRO: .next/static não encontrado!${NC}"
    exit 1
fi
echo ""

# 8. Verificar estrutura
echo "8. Verificando estrutura..."
if [ -f ".next/standalone/server.js" ]; then
    echo -e "${GREEN}✅ server.js encontrado${NC}"
else
    echo -e "${RED}❌ ERRO: server.js não encontrado!${NC}"
    exit 1
fi

if [ -d ".next/standalone/.next/static" ]; then
    echo -e "${GREEN}✅ Arquivos estáticos no lugar${NC}"
else
    echo -e "${RED}❌ ERRO: Arquivos estáticos não copiados corretamente!${NC}"
    exit 1
fi
echo ""

# 9. Iniciar com PM2
echo "9. Iniciando aplicação com PM2..."
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✅ Aplicação iniciada${NC}"
else
    pm2 start npm --name "crm-ymbale" -- start
    pm2 save
    echo -e "${GREEN}✅ Aplicação iniciada (sem config)${NC}"
fi
echo ""

# 10. Aguardar e verificar
echo "10. Aguardando inicialização..."
sleep 5

if pm2 status | grep -q "online"; then
    echo -e "${GREEN}✅ Aplicação está online!${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação pode não estar funcionando${NC}"
    echo "   Verifique os logs: pm2 logs crm-ymbale --lines 30"
fi
echo ""

# 11. Mostrar logs
echo "11. Últimas linhas dos logs:"
echo "------------------------------------------"
pm2 logs crm-ymbale --lines 15 --nostream 2>/dev/null || echo "Não foi possível ler logs"
echo ""

echo "=========================================="
echo "  CORREÇÃO CONCLUÍDA"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "  - Verificar status: pm2 status"
echo "  - Ver logs: pm2 logs crm-ymbale --lines 30"
echo "  - Testar no navegador"
echo ""

