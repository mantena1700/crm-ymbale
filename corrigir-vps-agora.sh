#!/bin/bash
# Script de Correção Rápida - Execute na VPS AGORA
# Este script corrige o problema de página não carregar

set -e

echo "=========================================="
echo "  CORREÇÃO RÁPIDA - CRM YMBALE"
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

echo -e "${GREEN}✅ Diretório: $(pwd)${NC}"
echo ""

# 1. Parar aplicação
echo "1. Parando aplicação..."
pm2 stop crm-ymbale 2>/dev/null || pm2 delete crm-ymbale 2>/dev/null || true
echo -e "${GREEN}✅ Aplicação parada${NC}"
echo ""

# 2. Verificar se build existe
echo "2. Verificando build..."
if [ ! -d ".next" ]; then
    echo -e "${RED}❌ Build não encontrado. Fazendo build...${NC}"
    npm run build
fi

if [ ! -d ".next/standalone" ]; then
    echo -e "${RED}❌ Standalone não encontrado. Fazendo build...${NC}"
    npm run build
fi
echo -e "${GREEN}✅ Build verificado${NC}"
echo ""

# 3. Copiar arquivos estáticos (CRÍTICO!)
echo "3. Copiando arquivos estáticos para standalone..."
if [ -d "public" ]; then
    cp -r public .next/standalone/ 2>/dev/null || true
    echo -e "${GREEN}✅ Arquivos públicos copiados${NC}"
else
    echo -e "${YELLOW}⚠️  Diretório public não encontrado${NC}"
fi

if [ -d ".next/static" ]; then
    mkdir -p .next/standalone/.next 2>/dev/null || true
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
    echo -e "${GREEN}✅ Arquivos estáticos copiados${NC}"
else
    echo -e "${YELLOW}⚠️  Diretório .next/static não encontrado${NC}"
fi
echo ""

# 4. Verificar se server.js existe
echo "4. Verificando servidor standalone..."
if [ ! -f ".next/standalone/server.js" ]; then
    echo -e "${RED}❌ server.js não encontrado! Fazendo rebuild...${NC}"
    npm run build
    cp -r public .next/standalone/ 2>/dev/null || true
    mkdir -p .next/standalone/.next 2>/dev/null || true
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
fi

if [ -f ".next/standalone/server.js" ]; then
    echo -e "${GREEN}✅ Servidor standalone encontrado${NC}"
else
    echo -e "${RED}❌ ERRO: server.js ainda não existe após rebuild${NC}"
    echo "   Verifique se next.config.ts tem output: 'standalone'"
    exit 1
fi
echo ""

# 5. Atualizar ecosystem.config.js
echo "5. Atualizando ecosystem.config.js..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    // Usar servidor standalone diretamente (mais eficiente)
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
echo ""

# 6. Criar diretório de logs se não existir
echo "6. Verificando diretório de logs..."
mkdir -p logs 2>/dev/null || true
echo -e "${GREEN}✅ Diretório de logs pronto${NC}"
echo ""

# 7. Iniciar com PM2
echo "7. Iniciando aplicação com PM2..."
pm2 delete crm-ymbale 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✅ Aplicação iniciada${NC}"
echo ""

# 8. Aguardar alguns segundos
echo "8. Aguardando inicialização..."
sleep 5
echo ""

# 9. Verificar status
echo "9. Verificando status..."
pm2 status
echo ""

# 10. Testar conexão
echo "10. Testando conexão local..."
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Servidor respondendo em localhost:3000${NC}"
else
    echo -e "${YELLOW}⚠️  Servidor não está respondendo ainda${NC}"
    echo "   Verifique os logs: pm2 logs crm-ymbale --err"
fi
echo ""

# 11. Mostrar logs recentes
echo "11. Últimas linhas dos logs:"
echo "------------------------------------------"
pm2 logs crm-ymbale --lines 15 --nostream 2>/dev/null || echo "Não foi possível ler logs"
echo ""

# Resumo
echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Correção aplicada!${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Verificar status: pm2 status"
echo "  2. Ver logs: pm2 logs crm-ymbale --lines 20"
echo "  3. Testar no navegador: http://SEU_IP:3000"
echo ""
echo "Se ainda não funcionar:"
echo "  - Ver logs de erro: pm2 logs crm-ymbale --err --lines 50"
echo "  - Verificar PostgreSQL: docker compose ps"
echo "  - Testar localmente: curl http://localhost:3000"
echo ""
echo "=========================================="

