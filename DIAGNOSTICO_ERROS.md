# 🔍 Diagnóstico Completo de Erros - CRM Ymbale

Guia completo para diagnosticar e resolver erros comuns durante o deploy e operação do sistema.

---

## 📋 Checklist de Diagnóstico Rápido

Execute estes comandos na VPS para identificar o problema:

```bash
# 1. Verificar PM2
pm2 --version
which pm2

# 2. Verificar Node.js
node --version
npm --version

# 3. Verificar se está no diretório correto
pwd
ls -la ecosystem.config.js

# 4. Verificar se build existe
ls -la .next

# 5. Verificar processos rodando
pm2 status
ps aux | grep node

# 6. Verificar porta
lsof -i :3000
netstat -tulpn | grep :3000

# 7. Verificar logs do PM2
pm2 logs crm-ymbale --lines 50 --err
```

---

## 🚨 Erros Comuns e Soluções

### 1. Erro: "pm2: command not found"

**Causa:** PM2 não está no PATH ou não foi instalado corretamente.

**Solução:**
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Verificar instalação
which pm2
pm2 --version

# Se não encontrar, adicionar ao PATH
export PATH=$PATH:/usr/local/bin
export PATH=$PATH:$(npm config get prefix)/bin

# OU usar npx
npx pm2 --version
```

---

### 2. Erro: "Cannot find module" ou "Module not found"

**Causa:** Dependências não instaladas ou node_modules corrompido.

**Solução:**
```bash
# Limpar e reinstalar
cd ~/crm-ymbale
rm -rf node_modules package-lock.json
npm install

# Verificar se Prisma está gerado
npx prisma generate

# Rebuild
npm run build
```

---

### 3. Erro: "Port 3000 already in use"

**Causa:** Outro processo está usando a porta 3000.

**Solução:**
```bash
# Verificar qual processo está usando
lsof -i :3000
# OU
netstat -tulpn | grep :3000

# Parar processo antigo
kill -9 PID

# OU parar todos processos Node
pkill -f "node.*next"
pkill -f "node.*server.js"

# Verificar se systemd está rodando
systemctl stop crm 2>/dev/null

# Depois iniciar com PM2
pm2 start ecosystem.config.js
```

---

### 4. Erro: "ecosystem.config.js not found"

**Causa:** Não está no diretório correto ou arquivo não existe.

**Solução:**
```bash
# Navegar para o diretório do projeto
cd ~/crm-ymbale
# OU
cd /root/crm-ymbale

# Verificar se arquivo existe
ls -la ecosystem.config.js

# Se não existir, criar manualmente ou usar comando direto:
pm2 start npm --name "crm-ymbale" -- start
```

---

### 5. Erro: "Error: Cannot find module '.next/standalone/server.js'"

**Causa:** Build não foi feito ou está incompleto.

**Solução:**
```bash
# Verificar se .next existe
ls -la .next

# Se não existir, fazer build
npm run build

# Verificar se standalone foi criado
ls -la .next/standalone

# Se não tiver standalone, verificar next.config.ts
cat next.config.ts
```

---

### 6. Erro: "Prisma Client not found" ou "Model not available"

**Causa:** Prisma Client não foi gerado ou está desatualizado.

**Solução:**
```bash
# Gerar Prisma Client
npx prisma generate

# Atualizar banco de dados
npx prisma db push

# Verificar se @prisma/client está instalado
npm list @prisma/client

# Se não estiver, instalar
npm install @prisma/client
```

---

### 7. Erro: "Database connection failed"

**Causa:** PostgreSQL não está rodando ou DATABASE_URL incorreta.

**Solução:**
```bash
# Verificar se Docker está rodando
docker ps

# Verificar se PostgreSQL está rodando
docker compose ps

# Iniciar PostgreSQL se necessário
docker compose up -d postgres

# Verificar conexão
docker compose exec postgres psql -U crm_user -d crm_ymbale -c "SELECT 1;"

# Verificar .env
cat .env | grep DATABASE_URL
```

---

### 8. Erro: "PM2 process keeps restarting" (errored status)

**Causa:** Aplicação está crashando ao iniciar.

**Solução:**
```bash
# Ver logs de erro detalhados
pm2 logs crm-ymbale --err --lines 100

# Verificar se build está correto
npm run build

# Verificar variáveis de ambiente
pm2 show crm-ymbale

# Parar e reiniciar
pm2 delete crm-ymbale
pm2 start ecosystem.config.js

# Verificar logs em tempo real
pm2 logs crm-ymbale
```

---

### 9. Erro: "EADDRINUSE: address already in use :::3000"

**Causa:** Porta 3000 já está em uso por outro processo.

**Solução:**
```bash
# Encontrar processo usando porta 3000
lsof -i :3000
# OU
fuser -k 3000/tcp

# Parar processo
kill -9 PID

# OU parar PM2 e reiniciar
pm2 delete all
pm2 start ecosystem.config.js
```

---

### 10. Erro: "ENOENT: no such file or directory" (logs)

**Causa:** Diretório de logs não existe.

**Solução:**
```bash
# Criar diretório de logs
mkdir -p ~/crm-ymbale/logs

# OU modificar ecosystem.config.js para usar caminho absoluto
# error_file: '/root/crm-ymbale/logs/err.log'
```

---

### 11. Erro: "Permission denied" ao iniciar PM2

**Causa:** Permissões insuficientes.

**Solução:**
```bash
# Verificar permissões
ls -la ecosystem.config.js

# Dar permissões se necessário
chmod +x ecosystem.config.js

# Verificar se está como root ou usar sudo
whoami

# Se necessário, usar sudo (não recomendado, mas funciona)
sudo pm2 start ecosystem.config.js
```

---

### 12. Erro: "PM2 startup command not found"

**Causa:** PM2 não está no PATH do sistema.

**Solução:**
```bash
# Encontrar caminho do PM2
which pm2

# Adicionar ao PATH permanentemente
echo 'export PATH=$PATH:$(npm config get prefix)/bin' >> ~/.bashrc
source ~/.bashrc

# OU executar comando manualmente (o que pm2 startup mostrar)
# Geralmente algo como:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

---

## 🔧 Script de Diagnóstico Automático

Crie e execute este script para diagnóstico completo:

```bash
#!/bin/bash
# diagnostico.sh

echo "=== DIAGNÓSTICO CRM YMBALE ==="
echo ""

echo "1. Verificando PM2..."
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 instalado: $(pm2 --version)"
    echo "   Localização: $(which pm2)"
else
    echo "❌ PM2 não encontrado"
    echo "   Execute: npm install -g pm2"
fi
echo ""

echo "2. Verificando Node.js..."
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
    echo "✅ npm: $(npm --version)"
else
    echo "❌ Node.js não encontrado"
fi
echo ""

echo "3. Verificando diretório do projeto..."
if [ -d ~/crm-ymbale ]; then
    cd ~/crm-ymbale
    echo "✅ Diretório encontrado: $(pwd)"
    echo "   ecosystem.config.js: $([ -f ecosystem.config.js ] && echo '✅ Existe' || echo '❌ Não existe')"
    echo "   .next: $([ -d .next ] && echo '✅ Existe' || echo '❌ Não existe - precisa fazer build')"
    echo "   node_modules: $([ -d node_modules ] && echo '✅ Existe' || echo '❌ Não existe - precisa npm install')"
else
    echo "❌ Diretório ~/crm-ymbale não encontrado"
fi
echo ""

echo "4. Verificando processos PM2..."
if command -v pm2 &> /dev/null; then
    pm2 status
else
    echo "❌ PM2 não disponível"
fi
echo ""

echo "5. Verificando porta 3000..."
if command -v lsof &> /dev/null; then
    PORT_PROCESS=$(lsof -i :3000 2>/dev/null)
    if [ -z "$PORT_PROCESS" ]; then
        echo "✅ Porta 3000 livre"
    else
        echo "⚠️  Porta 3000 em uso:"
        echo "$PORT_PROCESS"
    fi
else
    echo "⚠️  lsof não disponível, usando netstat..."
    netstat -tulpn | grep :3000 || echo "✅ Porta 3000 livre"
fi
echo ""

echo "6. Verificando Docker/PostgreSQL..."
if command -v docker &> /dev/null; then
    if docker ps | grep -q postgres; then
        echo "✅ PostgreSQL rodando"
    else
        echo "⚠️  PostgreSQL não está rodando"
        echo "   Execute: docker compose up -d postgres"
    fi
else
    echo "⚠️  Docker não encontrado"
fi
echo ""

echo "7. Verificando logs PM2 (últimas 10 linhas de erro)..."
if command -v pm2 &> /dev/null && pm2 list | grep -q crm-ymbale; then
    echo "Logs de erro:"
    pm2 logs crm-ymbale --err --lines 10 --nostream
else
    echo "⚠️  Aplicação não está rodando no PM2"
fi
echo ""

echo "=== FIM DO DIAGNÓSTICO ==="
```

**Para usar:**
```bash
# Salvar script
cat > ~/diagnostico.sh << 'EOF'
[cole o script acima]
EOF

# Dar permissão
chmod +x ~/diagnostico.sh

# Executar
~/diagnostico.sh
```

---

## 🎯 Fluxo de Resolução de Problemas

### Passo 1: Identificar o Erro
```bash
# Ver logs detalhados
pm2 logs crm-ymbale --err --lines 50
pm2 logs crm-ymbale --lines 50
```

### Passo 2: Verificar Pré-requisitos
```bash
# Node.js
node --version  # Deve ser 18+ ou 20+

# PM2
pm2 --version

# Build
ls -la .next

# Dependências
ls -la node_modules
```

### Passo 3: Limpar e Reconstruir
```bash
# Parar tudo
pm2 delete all
pkill -f node

# Limpar
rm -rf .next node_modules package-lock.json

# Reinstalar
npm install
npx prisma generate
npx prisma db push
npm run build
```

### Passo 4: Reiniciar
```bash
# Iniciar com PM2
pm2 start ecosystem.config.js
pm2 save

# Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 📝 Verificações Pós-Correção

Após corrigir qualquer erro, sempre verifique:

1. **Status do PM2:**
   ```bash
   pm2 status
   ```
   Deve mostrar `online` (não `errored` ou `stopped`)

2. **Logs sem erros:**
   ```bash
   pm2 logs crm-ymbale --err --lines 20
   ```
   Não deve ter mensagens de erro vermelhas

3. **Aplicação acessível:**
   ```bash
   curl http://localhost:3000
   ```
   Deve retornar HTML (não erro de conexão)

4. **Banco de dados:**
   ```bash
   docker compose exec postgres psql -U crm_user -d crm_ymbale -c "SELECT COUNT(*) FROM users;"
   ```
   Deve retornar um número (não erro)

---

## 🆘 Se Nada Funcionar

### Opção 1: Reset Completo
```bash
# ⚠️ CUIDADO: Isso vai parar tudo e limpar

# 1. Backup do banco
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_emergencia_$(date +%Y%m%d_%H%M%S).sql

# 2. Parar tudo
pm2 delete all
systemctl stop crm 2>/dev/null
pkill -f node

# 3. Limpar
cd ~/crm-ymbale
rm -rf .next node_modules package-lock.json

# 4. Reinstalar
npm install
npx prisma generate
npx prisma db push
npm run build

# 5. Reiniciar
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Opção 2: Usar Modo Standalone (Alternativa)
Se PM2 continuar dando problemas, use o método standalone:

```bash
# Build
npm run build

# Copiar arquivos
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Iniciar diretamente
cd .next/standalone
node server.js
```

---

## 📚 Referências Rápidas

- **PM2 Docs:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **Next.js Deploy:** https://nextjs.org/docs/deployment
- **Prisma Troubleshooting:** https://www.prisma.io/docs/guides/troubleshooting

---

**💡 Dica:** Sempre execute o script de diagnóstico antes de pedir ajuda. Ele identifica 90% dos problemas comuns!
