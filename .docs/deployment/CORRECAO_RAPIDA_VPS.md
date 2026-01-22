# 🚨 Correção Rápida - Página Não Carrega

## ⚡ Solução Imediata

Execute este comando na VPS **AGORA**:

```bash
cd ~/crm-ymbale
# ou
cd /root/crm-ymbale

# Baixar e executar script de correção
curl -o corrigir-vps-agora.sh https://raw.githubusercontent.com/mantena1700/crm-ymbale/main/corrigir-vps-agora.sh
# OU se já tiver o arquivo:
bash corrigir-vps-agora.sh
```

**OU execute manualmente:**

```bash
cd ~/crm-ymbale

# 1. Parar aplicação
pm2 stop crm-ymbale
pm2 delete crm-ymbale

# 2. Copiar arquivos estáticos (CRÍTICO!)
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

# 3. Atualizar ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
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
EOF

# 4. Criar diretório de logs
mkdir -p logs

# 5. Reiniciar
pm2 start ecosystem.config.js
pm2 save

# 6. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 🔍 Diagnóstico Rápido

Se ainda não funcionar, execute:

```bash
# 1. Ver logs de erro
pm2 logs crm-ymbale --err --lines 50

# 2. Verificar se arquivos existem
ls -la .next/standalone/server.js
ls -la .next/standalone/public
ls -la .next/standalone/.next/static

# 3. Testar servidor localmente
curl http://localhost:3000

# 4. Verificar PostgreSQL
docker compose ps

# 5. Verificar porta
lsof -i :3000
```

---

## 🐛 Problemas Comuns

### Problema: "Cannot find module '.next/standalone/server.js'"

**Solução:**
```bash
npm run build
ls -la .next/standalone/server.js
```

### Problema: Página carrega mas sem CSS/imagens

**Solução:**
```bash
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
pm2 restart crm-ymbale
```

### Problema: Erro de conexão com banco

**Solução:**
```bash
docker compose up -d postgres
docker compose ps
```

---

## ✅ Verificação Final

Após aplicar a correção, verifique:

```bash
# 1. Status online
pm2 status
# Deve mostrar: online

# 2. Sem erros nos logs
pm2 logs crm-ymbale --err --lines 20
# Não deve ter erros vermelhos

# 3. Servidor responde
curl http://localhost:3000
# Deve retornar HTML

# 4. Arquivos existem
ls -la .next/standalone/server.js
ls -la .next/standalone/public
# Ambos devem existir
```

---

**Execute os comandos acima e o problema deve ser resolvido!** 🎯

