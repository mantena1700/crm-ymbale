#!/bin/bash

# Script para criar a tabela fixed_clients na VPS
# Execute: bash scripts/setup-fixed-clients-vps.sh

echo "📦 Verificando cliente PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "📦 Instalando cliente PostgreSQL..."
    apt update
    apt install -y postgresql-client
fi

echo ""
echo "📄 Executando SQL para criar tabela fixed_clients..."

# Carregar .env se existir
if [ -f .env ]; then
    echo "✅ Carregando variáveis do .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Verificar se DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL não encontrada no .env"
    echo ""
    echo "Por favor, forneça as credenciais do banco:"
    echo ""
    read -p "Host (padrão: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    
    read -p "Porta (padrão: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    
    read -p "Usuário (padrão: postgres): " DB_USER
    DB_USER=${DB_USER:-postgres}
    
    read -p "Banco de dados (padrão: crm_ymbale): " DB_NAME
    DB_NAME=${DB_NAME:-crm_ymbale}
    
    read -sp "Senha: " DB_PASSWORD
    echo ""
    
    export PGPASSWORD="$DB_PASSWORD"
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -f scripts/create-fixed-clients-table.sql
else
    echo "✅ Usando DATABASE_URL do .env..."
    # Extrair componentes da DATABASE_URL
    # Formato: postgresql://user:password@host:port/database
    psql "$DATABASE_URL" -f scripts/create-fixed-clients-table.sql
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Tabela fixed_clients criada com sucesso!"
    echo ""
    echo "🔄 Agora execute:"
    echo "   npm run build"
    echo "   pm2 restart crm-ymbale"
else
    echo ""
    echo "❌ Erro ao criar tabela."
    echo ""
    echo "💡 Dicas:"
    echo "   1. Verifique se o PostgreSQL está rodando"
    echo "   2. Verifique as credenciais no .env"
    echo "   3. Se estiver usando Docker, use: docker exec -i <container> psql -U <user> -d <db> < scripts/create-fixed-clients-table.sql"
    exit 1
fi
