@echo off
REM Script para fazer commit das correções da VPS
REM Execute: fazer-commit.bat

echo ==========================================
echo   PREPARAR COMMIT - CORRECOES VPS
echo ==========================================
echo.

echo 1. Verificando status do Git...
git status
echo.

echo 2. Adicionando todos os arquivos...
git add .
echo.

echo 3. Verificando o que sera commitado...
git status
echo.

echo 4. Fazendo commit...
git commit -m "fix: Corrigir problemas de deploy na VPS apos atualizacao

- Atualizar ecosystem.config.js para usar npm start (mais confiavel)
- Adicionar copia automatica de arquivos estaticos no atualizar-vps.sh
- Adicionar documentacao completa de troubleshooting
- Adicionar scripts de correcao automatica
- Resolver problema de 'Application error: a client-side exception'
- Configurar suporte para porta 80 via Nginx"
echo.

echo 5. Enviando para o GitHub...
git push origin main
echo.

echo ==========================================
echo   COMMIT CONCLUIDO!
echo ==========================================
echo.
echo Proximos passos:
echo   1. Na VPS, execute: git pull origin main
echo   2. Ou execute: bash atualizar-vps.sh
echo.
pause

