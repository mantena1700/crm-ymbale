# 🔍 Análise do Problema Após Atualização na VPS

Este documento contém uma análise completa do CRM e guia para resolver problemas após atualização na VPS.

---

## 🎯 Problema Identificado

Após analisar o código, identifiquei um **problema crítico na configuração do PM2** que pode causar falhas após atualizações:

### ❌ Problema: Configuração do PM2 com Standalone

O arquivo `ecosystem.config.js` está configurado para usar `npm start`, mas quando o Next.js está em modo `standalone`, há uma incompatibilidade:

**Configuração Atual (Problemática):**
```javascript
script: 'npm',
args: 'start',
```

**Problema:** Com `output: 'standalone'` no `next.config.ts`, o Next.js gera um servidor standalone em `.next/standalone/server.js`, mas o `npm start` pode não encontrar corretamente os arquivos estáticos (`public` e `.next/static`).

---

## ✅ Soluções Recomendadas

### Solução 1: Corrigir ecosystem.config.js (RECOMENDADO)

Atualizar o `ecosystem.config.js` para usar o servidor standalone diretamente:

```javascript
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    script: '.next/standalone/server.js',
    cwd: process.cwd(),
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
```

**IMPORTANTE:** Antes de iniciar com PM2, você DEVE copiar os arquivos necessários:

```bash
# Após o build
npm run build

# Copiar arquivos estáticos para standalone
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```

### Solução 2: Manter npm start mas garantir arquivos

Se preferir manter `npm start`, certifique-se de que os arquivos estão no lugar certo:

```bash
# Após build, garantir que arquivos estão acessíveis
npm run build
ls -la .next/standalone
ls -la public
ls -la .next/static
```

---

## 🔧 Passos para Resolver o Problema

### Passo 1: Conectar na VPS

```bash
ssh usuario@seu_ip_vps
cd ~/crm-ymbale
# ou
cd /root/crm-ymbale
```

### Passo 2: Verificar Status Atual

```bash
# Ver status do PM2
pm2 status

# Ver logs de erro
pm2 logs crm-ymbale --err --lines 50

# Verificar se build existe
ls -la .next
ls -la .next/standalone
```

### Passo 3: Parar Aplicação

```bash
pm2 stop crm-ymbale
# ou
pm2 delete crm-ymbale
```

### Passo 4: Atualizar ecosystem.config.js

```bash
# Fazer backup
cp ecosystem.config.js ecosystem.config.js.backup

# Editar o arquivo (use nano ou vim)
nano ecosystem.config.js
```

Substitua por:

```javascript
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    script: '.next/standalone/server.js',
    cwd: process.cwd(),
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
```

### Passo 5: Rebuild e Preparar Standalone

```bash
# Limpar build anterior (opcional, mas recomendado)
rm -rf .next

# Rebuild
npm run build

# Verificar se standalone foi criado
ls -la .next/standalone

# Copiar arquivos necessários
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Verificar se server.js existe
ls -la .next/standalone/server.js
```

### Passo 6: Reiniciar com PM2

```bash
# Iniciar com nova configuração
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save

# Verificar status
pm2 status

# Ver logs
pm2 logs crm-ymbale --lines 20
```

### Passo 7: Verificar Funcionamento

```bash
# Testar localmente na VPS
curl http://localhost:3000

# Ver logs em tempo real
pm2 logs crm-ymbale
```

---

## 🐛 Problemas Comuns e Soluções

### Problema 1: "Cannot find module '.next/standalone/server.js'"

**Causa:** Build não foi feito ou está incompleto.

**Solução:**
```bash
npm run build
ls -la .next/standalone/server.js
```

### Problema 2: "ENOENT: no such file or directory" (arquivos estáticos)

**Causa:** Arquivos `public` e `.next/static` não foram copiados para standalone.

**Solução:**
```bash
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```

### Problema 3: Página carrega mas sem CSS/imagens

**Causa:** Arquivos estáticos não estão acessíveis.

**Solução:**
```bash
# Verificar se arquivos foram copiados
ls -la .next/standalone/public
ls -la .next/standalone/.next/static

# Se não existirem, copiar novamente
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
pm2 restart crm-ymbale
```

### Problema 4: Erro de conexão com banco de dados

**Causa:** PostgreSQL não está rodando ou DATABASE_URL incorreta.

**Solução:**
```bash
# Verificar PostgreSQL
docker compose ps

# Iniciar se necessário
docker compose up -d postgres

# Verificar conexão
docker compose exec postgres psql -U crm_user -d crm_ymbale -c "SELECT 1;"

# Verificar .env
cat .env | grep DATABASE_URL
```

### Problema 5: PM2 mostra status "errored"

**Causa:** Aplicação está crashando ao iniciar.

**Solução:**
```bash
# Ver logs detalhados
pm2 logs crm-ymbale --err --lines 100

# Verificar se server.js existe e tem permissões
ls -la .next/standalone/server.js
chmod +x .next/standalone/server.js

# Tentar executar manualmente para ver erro
cd .next/standalone
node server.js
```

---

## 📋 Checklist de Verificação

Após aplicar as correções, verifique:

- [ ] `pm2 status` mostra `online` (não `errored` ou `stopped`)
- [ ] `pm2 logs crm-ymbale --err` não tem erros
- [ ] `ls -la .next/standalone/server.js` mostra que arquivo existe
- [ ] `ls -la .next/standalone/public` mostra arquivos públicos
- [ ] `ls -la .next/standalone/.next/static` mostra arquivos estáticos
- [ ] `curl http://localhost:3000` retorna HTML (não erro)
- [ ] PostgreSQL está rodando (`docker compose ps`)
- [ ] Site carrega no navegador com CSS e imagens

---

## 🚨 Solução de Emergência (Reset Completo)

Se nada funcionar, faça um reset completo:

```bash
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

# 5. Preparar standalone
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# 6. Atualizar ecosystem.config.js (usar Solução 1 acima)

# 7. Reiniciar
pm2 start ecosystem.config.js
pm2 save

# 8. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 📝 Atualizar Script de Atualização

O script `atualizar-vps.sh` também precisa ser atualizado para copiar os arquivos estáticos. Verifique se ele inclui:

```bash
# Após npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```

---

## 💡 Dicas Importantes

1. **Sempre copie arquivos estáticos após build:** O modo standalone do Next.js não inclui automaticamente `public` e `.next/static` no diretório standalone.

2. **Use o servidor standalone diretamente:** É mais eficiente e evita problemas de caminhos.

3. **Monitore os logs:** Após qualquer mudança, sempre verifique `pm2 logs crm-ymbale --err`.

4. **Faça backup antes de mudanças:** Sempre faça backup do banco antes de atualizações grandes.

---

## 🆘 Precisa de Mais Ajuda?

1. Execute o diagnóstico: `bash diagnostico.sh`
2. Consulte `TROUBLESHOOTING_PAGINA_NAO_CARREGA.md`
3. Consulte `DIAGNOSTICO_ERROS.md`
4. Verifique logs detalhados: `pm2 logs crm-ymbale --err --lines 100`

---

**Última atualização:** Análise baseada na estrutura atual do projeto (Next.js 16 com output standalone)

