#!/bin/bash
# Script para verificar e corrigir arquivos estáticos no standalone

echo "=========================================="
echo "  VERIFICAÇÃO E CORREÇÃO DE ARQUIVOS ESTÁTICOS"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd ~/crm-ymbale

echo "1. Verificando arquivos estáticos originais..."
if [ -d ".next/static" ]; then
    echo -e "${GREEN}✅ .next/static existe${NC}"
    echo "   Conteúdo:"
    ls -la .next/static | head -10
else
    echo -e "${RED}❌ .next/static NÃO existe!${NC}"
    exit 1
fi
echo ""

echo "2. Verificando se foram copiados para standalone..."
if [ -d ".next/standalone/.next/static" ]; then
    echo -e "${GREEN}✅ .next/standalone/.next/static existe${NC}"
    echo "   Conteúdo:"
    ls -la .next/standalone/.next/static | head -10
    echo ""
    echo "   Verificando chunks:"
    if [ -d ".next/standalone/.next/static/chunks" ]; then
        echo -e "${GREEN}✅ chunks existe${NC}"
        ls .next/standalone/.next/static/chunks | head -5
    else
        echo -e "${RED}❌ chunks NÃO existe!${NC}"
    fi
else
    echo -e "${RED}❌ .next/standalone/.next/static NÃO existe!${NC}"
    echo "   Isso é o problema! Vou copiar agora..."
    echo ""
    
    # Copiar arquivos
    echo "3. Copiando arquivos estáticos..."
    mkdir -p .next/standalone/.next
    cp -r .next/static .next/standalone/.next/
    echo -e "${GREEN}✅ Arquivos copiados${NC}"
fi
echo ""

echo "4. Verificando arquivos públicos..."
if [ -d ".next/standalone/public" ]; then
    echo -e "${GREEN}✅ public existe${NC}"
    ls -la .next/standalone/public | head -5
else
    echo -e "${YELLOW}⚠️  public não existe, copiando...${NC}"
    cp -r public .next/standalone/
    echo -e "${GREEN}✅ public copiado${NC}"
fi
echo ""

echo "5. Verificando estrutura completa do standalone..."
echo "   Estrutura .next/standalone:"
ls -la .next/standalone/ | head -15
echo ""

echo "6. Verificando se .next/standalone/.next existe..."
if [ -d ".next/standalone/.next" ]; then
    echo -e "${GREEN}✅ .next/standalone/.next existe${NC}"
    echo "   Conteúdo:"
    ls -la .next/standalone/.next/
else
    echo -e "${RED}❌ .next/standalone/.next NÃO existe!${NC}"
    echo "   Criando e copiando..."
    mkdir -p .next/standalone/.next
    cp -r .next/static .next/standalone/.next/
    echo -e "${GREEN}✅ Criado e copiado${NC}"
fi
echo ""

echo "7. Verificando permissões..."
chmod -R 755 .next/standalone/.next/static 2>/dev/null || true
chmod -R 755 .next/standalone/public 2>/dev/null || true
echo -e "${GREEN}✅ Permissões ajustadas${NC}"
echo ""

echo "8. Resumo da estrutura:"
echo "   - server.js: $([ -f .next/standalone/server.js ] && echo '✅' || echo '❌')"
echo "   - public: $([ -d .next/standalone/public ] && echo '✅' || echo '❌')"
echo "   - .next/static: $([ -d .next/standalone/.next/static ] && echo '✅' || echo '❌')"
echo "   - .next/static/chunks: $([ -d .next/standalone/.next/static/chunks ] && echo '✅' || echo '❌')"
echo ""

echo "=========================================="
echo "  PRÓXIMOS PASSOS"
echo "=========================================="
echo ""
echo "Agora reinicie a aplicação:"
echo "  pm2 restart crm-ymbale"
echo ""
echo "Ou se estiver usando standalone:"
echo "  pm2 delete crm-ymbale"
echo "  pm2 start ecosystem.config.js"
echo ""

