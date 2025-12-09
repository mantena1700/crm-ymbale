#!/bin/bash
# Script para corrigir erro de cliente (Application error)
# Execute na VPS

set -e

echo "=========================================="
echo "  CORREÇÃO ERRO CLIENTE - CRM YMBALE"
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
    exit 1
fi

echo -e "${GREEN}✅ Diretório: $(pwd)${NC}"
echo ""

# 1. Parar aplicação
echo "1. Parando aplicação..."
pm2 stop crm-ymbale 2>/dev/null || pm2 delete crm-ymbale 2>/dev/null || true
echo -e "${GREEN}✅ Aplicação parada${NC}"
echo ""

# 2. Limpar build anterior
echo "2. Limpando build anterior..."
rm -rf .next
echo -e "${GREEN}✅ Build limpo${NC}"
echo ""

# 3. Rebuild completo
echo "3. Fazendo rebuild completo..."
npm run build
echo -e "${GREEN}✅ Build concluído${NC}"
echo ""

# 4. Verificar se standalone foi criado
echo "4. Verificando standalone..."
if [ ! -d ".next/standalone" ]; then
    echo -e "${RED}❌ ERRO: Standalone não foi criado!${NC}"
    echo "   Verifique se next.config.ts tem output: 'standalone'"
    exit 1
fi
echo -e "${GREEN}✅ Standalone encontrado${NC}"
echo ""

# 5. Copiar arquivos estáticos (CRÍTICO!)
echo "5. Copiando arquivos estáticos..."
if [ -d "public" ]; then
    cp -r public .next/standalone/
    echo -e "${GREEN}✅ Arquivos públicos copiados${NC}"
else
    echo -e "${YELLOW}⚠️  Diretório public não encontrado${NC}"
fi

if [ -d ".next/static" ]; then
    mkdir -p .next/standalone/.next
    cp -r .next/static .next/standalone/.next/
    echo -e "${GREEN}✅ Arquivos estáticos (.next/static) copiados${NC}"
else
    echo -e "${RED}❌ ERRO: .next/static não encontrado!${NC}"
    echo "   Isso pode causar o erro de cliente"
fi
echo ""

# 6. Verificar estrutura completa
echo "6. Verificando estrutura de arquivos..."
echo "   Verificando server.js..."
if [ -f ".next/standalone/server.js" ]; then
    echo -e "${GREEN}✅ server.js existe${NC}"
else
    echo -e "${RED}❌ server.js NÃO existe!${NC}"
    exit 1
fi

echo "   Verificando public..."
if [ -d ".next/standalone/public" ]; then
    echo -e "${GREEN}✅ public existe${NC}"
else
    echo -e "${YELLOW}⚠️  public não existe${NC}"
fi

echo "   Verificando .next/static..."
if [ -d ".next/standalone/.next/static" ]; then
    echo -e "${GREEN}✅ .next/static existe${NC}"
    echo "   Conteúdo:"
    ls -la .next/standalone/.next/static | head -5
else
    echo -e "${RED}❌ .next/static NÃO existe!${NC}"
    echo "   Isso é CRÍTICO - causa erro de cliente!"
fi
echo ""

# 7. Verificar se há arquivos .next/standalone/.next além de static
echo "7. Verificando estrutura .next dentro de standalone..."
if [ -d ".next/standalone/.next" ]; then
    echo "   Conteúdo de .next/standalone/.next:"
    ls -la .next/standalone/.next/ | head -10
    echo ""
fi

# 8. Copiar também outros arquivos necessários do .next
echo "8. Copiando outros arquivos necessários..."
if [ -f ".next/BUILD_ID" ]; then
    mkdir -p .next/standalone/.next
    cp .next/BUILD_ID .next/standalone/.next/ 2>/dev/null || true
    echo -e "${GREEN}✅ BUILD_ID copiado${NC}"
fi

# Copiar arquivos de cache se existirem
if [ -d ".next/cache" ]; then
    mkdir -p .next/standalone/.next
    cp -r .next/cache .next/standalone/.next/ 2>/dev/null || true
    echo -e "${GREEN}✅ Cache copiado${NC}"
fi
echo ""

# 9. Atualizar ecosystem.config.js
echo "9. Verificando ecosystem.config.js..."
if grep -q "\.next/standalone/server\.js" ecosystem.config.js; then
    echo -e "${GREEN}✅ ecosystem.config.js está correto${NC}"
else
    echo -e "${YELLOW}⚠️  Atualizando ecosystem.config.js...${NC}"
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    script: '.next/standalone/server.js',
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
    echo -e "${GREEN}✅ ecosystem.config.js atualizado${NC}"
fi
echo ""

# 10. Criar diretório de logs
mkdir -p logs 2>/dev/null || true

# 11. Reiniciar
echo "10. Reiniciando aplicação..."
pm2 delete crm-ymbale 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✅ Aplicação reiniciada${NC}"
echo ""

# 12. Aguardar
echo "11. Aguardando inicialização..."
sleep 5
echo ""

# 13. Verificar status
echo "12. Status da aplicação:"
pm2 status
echo ""

# 14. Testar
echo "13. Testando servidor..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Servidor respondendo${NC}"
    echo ""
    echo "   Teste completo:"
    curl -s http://localhost:3000 | head -20
else
    echo -e "${YELLOW}⚠️  Servidor pode não estar respondendo corretamente${NC}"
fi
echo ""

# 15. Mostrar logs
echo "14. Últimas linhas dos logs:"
echo "------------------------------------------"
pm2 logs crm-ymbale --lines 20 --nostream 2>/dev/null || echo "Não foi possível ler logs"
echo ""

# Resumo
echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Correção aplicada!${NC}"
echo ""
echo "Verificações importantes:"
echo "  ✓ Build completo feito"
echo "  ✓ Arquivos estáticos copiados"
echo "  ✓ Servidor standalone configurado"
echo ""
echo "Próximos passos:"
echo "  1. Verificar logs: pm2 logs crm-ymbale --err --lines 50"
echo "  2. Testar no navegador: http://SEU_IP:3000"
echo "  3. Se ainda der erro, verifique o console do navegador (F12)"
echo ""
echo "Se ainda não funcionar, execute:"
echo "  pm2 logs crm-ymbale --err --lines 100"
echo "  E envie os erros para análise"
echo ""
echo "=========================================="

