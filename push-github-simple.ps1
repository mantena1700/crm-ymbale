# Script simples para push GitHub
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Output "=== Iniciando push para GitHub ===" | Tee-Object -FilePath "github-push.log"

# Verificar se Git está inicializado
if (-not (Test-Path ".git")) {
    Write-Output "Inicializando Git..." | Tee-Object -FilePath "github-push.log" -Append
    git init
    git branch -M main
}

# Adicionar tudo
Write-Output "Adicionando arquivos..." | Tee-Object -FilePath "github-push.log" -Append
git add -A

# Commit
Write-Output "Fazendo commit..." | Tee-Object -FilePath "github-push.log" -Append
git commit -m "Initial commit - CRM Ymbale" 2>&1 | Tee-Object -FilePath "github-push.log" -Append

# Obter usuário GitHub
$username = gh api user --jq .login 2>&1 | Tee-Object -FilePath "github-push.log" -Append
Write-Output "Usuário GitHub: $username" | Tee-Object -FilePath "github-push.log" -Append

# Criar repositório
Write-Output "Criando repositório..." | Tee-Object -FilePath "github-push.log" -Append
gh repo create crm-ymbale --private --source=. --push 2>&1 | Tee-Object -FilePath "github-push.log" -Append

Write-Output "=== Concluído! Verifique github-push.log ===" | Tee-Object -FilePath "github-push.log" -Append
