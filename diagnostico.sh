#!/bin/bash
# Script de Diagnóstico Automático - CRM Ymbale
# Execute: bash diagnostico.sh

echo "=========================================="
echo "  DIAGNÓSTICO CRM YMBALE"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar PM2
echo "1. Verificando PM2..."
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version 2>/dev/null)
    PM2_PATH=$(which pm2)
    echo -e "${GREEN}✅ PM2 instalado: $PM2_VERSION${NC}"
    echo "   Localização: $PM2_PATH"
else
    echo -e "${RED}❌ PM2 não encontrado${NC}"
    echo "   Execute: npm install -g pm2"
fi
echo ""

# 2. Verificar Node.js
echo "2. Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
    echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js não encontrado${NC}"
fi
echo ""

# 3. Verificar diretório do projeto
echo "3. Verificando diretório do projeto..."
PROJECT_DIR=""
if [ -d ~/crm-ymbale ]; then
    PROJECT_DIR=~/crm-ymbale
elif [ -d /root/crm-ymbale ]; then
    PROJECT_DIR=/root/crm-ymbale
else
    echo -e "${RED}❌ Diretório do projeto não encontrado${NC}"
    echo "   Procurando em: ~/crm-ymbale ou /root/crm-ymbale"
fi

if [ -n "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR" 2>/dev/null || exit 1
    echo -e "${GREEN}✅ Diretório encontrado: $(pwd)${NC}"
    
    if [ -f ecosystem.config.js ]; then
        echo -e "${GREEN}   ✅ ecosystem.config.js existe${NC}"
    else
        echo -e "${RED}   ❌ ecosystem.config.js não existe${NC}"
    fi
    
    if [ -d .next ]; then
        echo -e "${GREEN}   ✅ .next existe (build feito)${NC}"
    else
        echo -e "${YELLOW}   ⚠️  .next não existe - precisa fazer build${NC}"
    fi
    
    if [ -d node_modules ]; then
        echo -e "${GREEN}   ✅ node_modules existe${NC}"
    else
        echo -e "${RED}   ❌ node_modules não existe - precisa npm install${NC}"
    fi
    
    if [ -f .env ]; then
        echo -e "${GREEN}   ✅ .env existe${NC}"
    else
        echo -e "${YELLOW}   ⚠️  .env não existe${NC}"
    fi
fi
echo ""

# 4. Verificar processos PM2
echo "4. Verificando processos PM2..."
if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q crm-ymbale; then
        echo -e "${GREEN}✅ Aplicação encontrada no PM2${NC}"
        pm2 status | grep crm-ymbale
    else
        echo -e "${YELLOW}⚠️  Aplicação não está rodando no PM2${NC}"
    fi
else
    echo -e "${RED}❌ PM2 não disponível${NC}"
fi
echo ""

# 5. Verificar porta 3000
echo "5. Verificando porta 3000..."
if command -v lsof &> /dev/null; then
    PORT_PROCESS=$(lsof -i :3000 2>/dev/null)
    if [ -z "$PORT_PROCESS" ]; then
        echo -e "${GREEN}✅ Porta 3000 livre${NC}"
    else
        echo -e "${YELLOW}⚠️  Porta 3000 em uso:${NC}"
        echo "$PORT_PROCESS"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tulpn 2>/dev/null | grep -q :3000; then
        echo -e "${YELLOW}⚠️  Porta 3000 em uso${NC}"
        netstat -tulpn | grep :3000
    else
        echo -e "${GREEN}✅ Porta 3000 livre${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Não foi possível verificar porta (lsof/netstat não disponível)${NC}"
fi
echo ""

# 6. Verificar Docker/PostgreSQL
echo "6. Verificando Docker/PostgreSQL..."
if command -v docker &> /dev/null; then
    if docker ps 2>/dev/null | grep -q postgres; then
        echo -e "${GREEN}✅ PostgreSQL rodando${NC}"
    else
        echo -e "${YELLOW}⚠️  PostgreSQL não está rodando${NC}"
        echo "   Execute: docker compose up -d postgres"
    fi
else
    echo -e "${YELLOW}⚠️  Docker não encontrado${NC}"
fi
echo ""

# 7. Verificar logs PM2
echo "7. Verificando logs PM2 (últimas 5 linhas de erro)..."
if command -v pm2 &> /dev/null && pm2 list 2>/dev/null | grep -q crm-ymbale; then
    ERRORS=$(pm2 logs crm-ymbale --err --lines 5 --nostream 2>/dev/null)
    if [ -n "$ERRORS" ]; then
        echo -e "${YELLOW}⚠️  Erros encontrados:${NC}"
        echo "$ERRORS"
    else
        echo -e "${GREEN}✅ Nenhum erro recente${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Aplicação não está rodando no PM2${NC}"
fi
echo ""

# 8. Verificar Prisma
echo "8. Verificando Prisma..."
if [ -n "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR/node_modules" ]; then
    cd "$PROJECT_DIR" 2>/dev/null || exit 1
    if [ -f node_modules/.prisma/client/index.js ]; then
        echo -e "${GREEN}✅ Prisma Client gerado${NC}"
    else
        echo -e "${YELLOW}⚠️  Prisma Client não gerado${NC}"
        echo "   Execute: npx prisma generate"
    fi
fi
echo ""

# Resumo
echo "=========================================="
echo "  RESUMO"
echo "=========================================="

ISSUES=0

if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 não instalado${NC}"
    ((ISSUES++))
fi

if [ -z "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Projeto não encontrado${NC}"
    ((ISSUES++))
elif [ ! -d .next ]; then
    echo -e "${YELLOW}⚠️  Build não encontrado${NC}"
    ((ISSUES++))
fi

if ! docker ps 2>/dev/null | grep -q postgres; then
    echo -e "${YELLOW}⚠️  PostgreSQL não está rodando${NC}"
    ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Tudo parece estar OK!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. Verificar status: pm2 status"
    echo "  2. Ver logs: pm2 logs crm-ymbale --lines 20"
    echo "  3. Acessar site no navegador"
else
    echo -e "${YELLOW}⚠️  $ISSUES problema(s) encontrado(s)${NC}"
    echo ""
    echo "Consulte DIAGNOSTICO_ERROS.md para soluções"
fi

echo ""
echo "=========================================="
# Execução automática se desejado
read -p "Deseja executar os comandos de verificação automaticamente? (s/n): " EXEC_RES
if [[ "$EXEC_RES" =~ ^[Ss]$ ]]; then
    echo ""
    echo "Executando sequência de diagnóstico:"
    echo "------------------------------------------"
    echo "pm2 --version"
    pm2 --version
    echo "which pm2"
    which pm2

    echo "node --version"
    node --version
    echo "npm --version"
    npm --version

    echo "pwd"
    pwd

    echo "ls -la ecosystem.config.js"
    ls -la ecosystem.config.js 2>/dev/null

    echo "ls -la .next"
    ls -la .next 2>/dev/null

    echo "pm2 status"
    pm2 status

    echo "ps aux | grep node"
    ps aux | grep node

    echo "lsof -i :3000"
    lsof -i :3000 2>/dev/null || netstat -tulpn | grep :3000 2>/dev/null

    echo "pm2 logs crm-ymbale --lines 20 --err"
    pm2 logs crm-ymbale --lines 20 --err

    echo ""
    echo "Diagnóstico automático finalizado!"
    echo "Consulte as saídas acima para mais detalhes."
fi
