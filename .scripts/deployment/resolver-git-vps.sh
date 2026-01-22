#!/bin/bash
# Script simples para resolver problema de Git na VPS
# Execute: bash resolver-git-vps.sh

echo "=========================================="
echo "  RESOLVER PROBLEMA GIT - VPS"
echo "=========================================="
echo ""

cd ~/crm-ymbale

echo "1. Verificando status atual..."
git status
echo ""

echo "2. Fazendo fetch..."
git fetch origin main
echo ""

echo "3. Resetando para versão remota (descartando mudanças locais)..."
git reset --hard origin/main
echo ""

echo "4. Limpando arquivos não rastreados..."
git clean -fd
echo ""

echo "5. Verificando se está atualizado..."
git status
echo ""

echo "=========================================="
echo "  ✅ GIT RESOLVIDO!"
echo "=========================================="
echo ""
echo "Agora execute: bash atualizar-vps.sh"
echo ""

