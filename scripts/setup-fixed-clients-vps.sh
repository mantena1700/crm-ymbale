#!/bin/bash

# Script para criar a tabela fixed_clients na VPS
# Execute: bash scripts/setup-fixed-clients-vps.sh

echo "📦 Instalando cliente PostgreSQL..."
apt update
apt install -y postgresql-client

echo ""
echo "📄 Executando SQL para criar tabela fixed_clients..."

# Verificar se DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL não encontrada. Usando variáveis padrão..."
    # Ajuste conforme seu ambiente
    DB_HOST="${DB_HOST:-localhost}"
    DB_USER="${DB_USER:-postgres}"
    DB_NAME="${DB_NAME:-crm_ymbale}"
    DB_PORT="${DB_PORT:-5432}"
    
    # Se tiver senha em variável
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
        psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -f scripts/create-fixed-clients-table.sql
    else
        psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -f scripts/create-fixed-clients-table.sql
    fi
else
    echo "✅ Usando DATABASE_URL..."
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
    echo "❌ Erro ao criar tabela. Verifique as credenciais do banco."
    exit 1
fi

