# Script para fazer push do CRM Ymbale para GitHub
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CRM Ymbale - Push para GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Mudar para o diretório do projeto
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "Diretório: $projectPath" -ForegroundColor Yellow
Write-Host ""

# Verificar Git
Write-Host "[1/7] Verificando Git..." -ForegroundColor Green
try {
    $gitVersion = git --version
    Write-Host "  $gitVersion" -ForegroundColor Gray
} catch {
    Write-Host "  ERRO: Git não encontrado!" -ForegroundColor Red
    exit 1
}

# Verificar GitHub CLI
Write-Host "[2/7] Verificando GitHub CLI..." -ForegroundColor Green
try {
    $ghVersion = gh --version 2>&1 | Select-Object -First 1
    Write-Host "  $ghVersion" -ForegroundColor Gray
} catch {
    Write-Host "  ERRO: GitHub CLI não encontrado!" -ForegroundColor Red
    Write-Host "  Instale em: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# Verificar autenticação
Write-Host "[3/7] Verificando autenticação GitHub..." -ForegroundColor Green
try {
    $authStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Não autenticado. Fazendo login..." -ForegroundColor Yellow
        gh auth login
    } else {
        Write-Host "  Autenticado!" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ERRO ao verificar autenticação" -ForegroundColor Red
    exit 1
}

# Obter usuário GitHub
Write-Host "[4/7] Obtendo usuário GitHub..." -ForegroundColor Green
try {
    $username = gh api user --jq .login
    Write-Host "  Usuário: $username" -ForegroundColor Gray
} catch {
    Write-Host "  ERRO ao obter usuário" -ForegroundColor Red
    exit 1
}

# Inicializar Git se necessário
Write-Host "[5/7] Verificando repositório Git..." -ForegroundColor Green
if (-not (Test-Path ".git")) {
    Write-Host "  Inicializando repositório..." -ForegroundColor Yellow
    git init
    git branch -M main
}

# Adicionar e commitar
Write-Host "[6/7] Adicionando arquivos..." -ForegroundColor Green
git add -A
$commitStatus = git commit -m "Initial commit - CRM Ymbale" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Commit criado!" -ForegroundColor Gray
} else {
    Write-Host "  Nada para commitar ou commit já existe" -ForegroundColor Yellow
}

# Criar repositório no GitHub
Write-Host "[7/7] Criando repositório no GitHub..." -ForegroundColor Green
$repoUrl = "https://github.com/$username/crm-ymbale.git"

# Verificar se repositório já existe
$repoExists = gh repo view "$username/crm-ymbale" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Repositório já existe!" -ForegroundColor Yellow
} else {
    Write-Host "  Criando repositório privado..." -ForegroundColor Yellow
    gh repo create crm-ymbale --private --description "CRM Ymbale - Sistema de gestão de prospecção de restaurantes" --confirm
}

# Configurar remote
Write-Host ""
Write-Host "Configurando remote..." -ForegroundColor Green
$currentRemote = git remote get-url origin 2>&1
if ($LASTEXITCODE -ne 0) {
    git remote add origin $repoUrl
    Write-Host "  Remote adicionado: $repoUrl" -ForegroundColor Gray
} else {
    git remote set-url origin $repoUrl
    Write-Host "  Remote atualizado: $repoUrl" -ForegroundColor Gray
}

# Fazer push
Write-Host ""
Write-Host "Fazendo push para GitHub..." -ForegroundColor Green
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCESSO! Código enviado para GitHub!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repositório: $repoUrl" -ForegroundColor Cyan
    Write-Host ""
    
    # Abrir no navegador
    $openBrowser = Read-Host "Deseja abrir o repositório no navegador? (S/N)"
    if ($openBrowser -eq "S" -or $openBrowser -eq "s") {
        Start-Process $repoUrl
    }
} else {
    Write-Host ""
    Write-Host "ERRO ao fazer push!" -ForegroundColor Red
    Write-Host "Verifique as mensagens acima." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Pressione Enter para sair"
