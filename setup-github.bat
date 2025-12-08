@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   CRM Ymbale - Setup GitHub
echo ========================================
echo.

cd /d "%~dp0"
echo Diretório atual: %CD%
echo.

echo [1/6] Verificando Git...
git --version
if errorlevel 1 (
    echo ERRO: Git não encontrado! Instale o Git primeiro.
    echo Download: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo.

echo [2/6] Verificando GitHub CLI...
gh --version
if errorlevel 1 (
    echo ERRO: GitHub CLI não encontrado!
    echo Download: https://cli.github.com/
    pause
    exit /b 1
)
echo.

echo [3/6] Verificando autenticação GitHub...
gh auth status
if errorlevel 1 (
    echo.
    echo Você precisa fazer login no GitHub CLI.
    echo Executando: gh auth login
    echo.
    gh auth login
)
echo.

echo [4/6] Inicializando repositório Git...
if exist ".git" (
    echo Repositório Git já existe.
) else (
    git init
    echo Repositório inicializado.
)
echo.

echo [5/6] Configurando Git (se necessário)...
git config user.email >nul 2>&1
if errorlevel 1 (
    set /p EMAIL="Digite seu email do GitHub: "
    set /p NOME="Digite seu nome: "
    git config user.email "%EMAIL%"
    git config user.name "%NOME%"
)
echo.

echo [6/6] Adicionando arquivos e fazendo commit...
git add -A
git commit -m "Initial commit - CRM Ymbale" 2>nul
if errorlevel 1 (
    echo Commit já existe ou nada para commitar.
)
echo.

echo ========================================
echo   Criando repositório no GitHub...
echo ========================================
echo.

gh repo create crm-ymbale --private --source=. --push

if errorlevel 1 (
    echo.
    echo Se o repositório já existe, tente:
    echo   git remote add origin https://github.com/SEU_USUARIO/crm-ymbale.git
    echo   git push -u origin main
) else (
    echo.
    echo ========================================
    echo   SUCESSO! Repositório criado!
    echo ========================================
    echo.
    gh repo view --web
)

echo.
pause
