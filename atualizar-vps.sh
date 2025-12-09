#!/bin/bash
# Script de Atualização Automática na VPS
# Execute: bash atualizar-vps.sh

set -e  # Parar em caso de erro

echo "=========================================="
echo "  ATUALIZAÇÃO CRM YMBALE - VPS"
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
echo -e "${GREEN}✅ Diretório do projeto: $PROJECT_DIR${NC}"
echo ""

# 1. Backup do Banco de Dados
echo "1. Fazendo backup do banco de dados..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
if docker compose exec -T postgres pg_dump -U crm_user crm_ymbale > "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Não foi possível fazer backup do banco${NC}"
    echo "   Continuando mesmo assim..."
fi
echo ""

# 2. Verificar Git
echo "2. Verificando Git..."
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Git encontrado${NC}"
echo ""

# 3. Atualizar Código do GitHub
echo "3. Atualizando código do GitHub..."
if git pull origin main; then
    echo -e "${GREEN}✅ Código atualizado${NC}"
else
    echo -e "${RED}❌ Erro ao atualizar código${NC}"
    echo "   Verifique sua conexão e permissões do Git"
    exit 1
fi
echo ""

# 4. Instalar/Atualizar Dependências
echo "4. Instalando dependências..."
if npm install; then
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
else
    echo -e "${RED}❌ Erro ao instalar dependências${NC}"
    exit 1
fi
echo ""

# 5. Atualizar Prisma
echo "5. Atualizando Prisma..."
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

# 6. Build
echo "6. Fazendo build..."
if npm run build; then
    echo -e "${GREEN}✅ Build concluído${NC}"
else
    echo -e "${RED}❌ Erro no build${NC}"
    echo "   Verifique os logs acima"
    exit 1
fi
echo ""

# 6.1. Preparar arquivos standalone (CRÍTICO para modo standalone)
echo "6.1. Preparando arquivos standalone..."
if [ -d ".next/standalone" ]; then
    # Copiar arquivos públicos e estáticos para standalone
    if [ -d "public" ]; then
        cp -r public .next/standalone/ 2>/dev/null || true
        echo -e "${GREEN}✅ Arquivos públicos copiados${NC}"
    fi
    if [ -d ".next/static" ]; then
        mkdir -p .next/standalone/.next 2>/dev/null || true
        cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
        echo -e "${GREEN}✅ Arquivos estáticos copiados${NC}"
    fi
    if [ -f ".next/standalone/server.js" ]; then
        echo -e "${GREEN}✅ Servidor standalone pronto${NC}"
    else
        echo -e "${YELLOW}⚠️  Aviso: server.js não encontrado em .next/standalone${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Aviso: Diretório .next/standalone não encontrado${NC}"
    echo "   O build pode não ter gerado o modo standalone corretamente"
fi
echo ""

# 7. Parar Aplicação Antiga
echo "7. Parando aplicação antiga..."
if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q crm-ymbale; then
        pm2 stop crm-ymbale 2>/dev/null || true
        echo -e "${GREEN}✅ Aplicação parada${NC}"
    else
        echo -e "${YELLOW}⚠️  Aplicação não estava rodando no PM2${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 não encontrado, tentando parar processos Node...${NC}"
    pkill -f "node.*next" 2>/dev/null || true
    systemctl stop crm 2>/dev/null || true
fi
echo ""

# 8. Iniciar com PM2
echo "8. Iniciando aplicação com PM2..."
if command -v pm2 &> /dev/null; then
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js
        pm2 save
        echo -e "${GREEN}✅ Aplicação iniciada com PM2${NC}"
    else
        pm2 start npm --name "crm-ymbale" -- start
        pm2 save
        echo -e "${GREEN}✅ Aplicação iniciada com PM2 (sem config)${NC}"
    fi
else
    echo -e "${RED}❌ PM2 não encontrado${NC}"
    echo "   Execute: npm install -g pm2"
    exit 1
fi
echo ""

# 9. Verificar Status
echo "9. Verificando status..."
sleep 3
if pm2 status 2>/dev/null | grep -q "online"; then
    echo -e "${GREEN}✅ Aplicação está online${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação pode não estar funcionando corretamente${NC}"
    echo "   Verifique os logs: pm2 logs crm-ymbale --err"
fi
echo ""

# 10. Mostrar Logs
echo "10. Últimas linhas dos logs:"
echo "------------------------------------------"
pm2 logs crm-ymbale --lines 10 --nostream 2>/dev/null || echo "Não foi possível ler logs"
echo ""

# Resumo
echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Atualização concluída!${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Verificar status: pm2 status"
echo "  2. Ver logs: pm2 logs crm-ymbale --lines 20"
echo "  3. Acessar site no navegador"
echo "  4. Testar funcionalidades"
echo ""
echo "Se houver problemas:"
echo "  - Execute: bash diagnostico.sh"
echo "  - Consulte: TROUBLESHOOTING.md"
echo ""
echo "=========================================="
