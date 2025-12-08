# Script para iniciar o servidor Next.js
cd $PSScriptRoot
Write-Host "Iniciando servidor Next.js..." -ForegroundColor Green
Write-Host "Diretório: $PWD" -ForegroundColor Yellow

# Verificar se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependências..." -ForegroundColor Yellow
    npm install
}

# Verificar se Prisma Client está gerado
if (-not (Test-Path "node_modules\.prisma")) {
    Write-Host "Gerando Prisma Client..." -ForegroundColor Yellow
    npx prisma generate
}

Write-Host "Iniciando servidor de desenvolvimento..." -ForegroundColor Green
npm run dev
