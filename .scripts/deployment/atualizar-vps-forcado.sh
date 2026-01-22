#!/bin/bash
# Script de Atualização Forçada na VPS (ignora mudanças locais)
# Execute: bash atualizar-vps-forcado.sh
# ATENÇÃO: Este script descarta todas as mudanças locais!

set -e

echo "=========================================="
echo "  ATUALIZAÇÃO FORÇADA - VPS"
echo "=========================================="
echo ""
echo -e "${YELLOW}⚠️  ATENÇÃO: Este script descarta TODAS as mudanças locais!${NC}"
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
echo -e "${GREEN}✅ Diretório do projeto: $PROJECT_DIR${NC}"
echo ""

# 1. Backup do Banco de Dados
echo "1. Fazendo backup do banco de dados..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
if docker compose exec -T postgres pg_dump -U crm_user crm_ymbale > "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Não foi possível fazer backup do banco${NC}"
fi
echo ""

# 2. Reset Git para versão remota
echo "2. Resetando código para versão remota..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo -e "${GREEN}✅ Código resetado para versão remota${NC}"
echo ""

# 3. Instalar/Atualizar Dependências
echo "3. Instalando dependências..."
if npm install; then
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
else
    echo -e "${RED}❌ Erro ao instalar dependências${NC}"
    exit 1
fi
echo ""

# 4. Atualizar Prisma
echo "4. Atualizando Prisma..."
if npx prisma generate; then
    echo -e "${GREEN}✅ Prisma Client gerado${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Erro ao gerar Prisma Client${NC}"
fi

if npx prisma db push; then
    echo -e "${GREEN}✅ Banco de dados atualizado${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Erro ao atualizar banco de dados${NC}"
fi
echo ""

# 5. Build
echo "5. Fazendo build..."
if npm run build; then
    echo -e "${GREEN}✅ Build concluído${NC}"
else
    echo -e "${RED}❌ Erro no build${NC}"
    exit 1
fi
echo ""

# 6. Preparar arquivos standalone
echo "6. Preparando arquivos standalone..."
if [ -d ".next/standalone" ]; then
    if [ -d "public" ]; then
        cp -r public .next/standalone/ 2>/dev/null || true
        echo -e "${GREEN}✅ Arquivos públicos copiados${NC}"
    fi
    if [ -d ".next/static" ]; then
        mkdir -p .next/standalone/.next 2>/dev/null || true
        cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
        echo -e "${GREEN}✅ Arquivos estáticos copiados${NC}"
    fi
fi
echo ""

# 7. Parar Aplicação
echo "7. Parando aplicação..."
pm2 stop crm-ymbale 2>/dev/null || true
echo -e "${GREEN}✅ Aplicação parada${NC}"
echo ""

# 8. Iniciar com PM2
echo "8. Iniciando aplicação..."
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✅ Aplicação iniciada${NC}"
else
    pm2 start npm --name "crm-ymbale" -- start
    pm2 save
    echo -e "${GREEN}✅ Aplicação iniciada${NC}"
fi
echo ""

# 9. Verificar Status
echo "9. Verificando status..."
sleep 3
pm2 status
echo ""

echo "=========================================="
echo "  ATUALIZAÇÃO FORÇADA CONCLUÍDA!"
echo "=========================================="

