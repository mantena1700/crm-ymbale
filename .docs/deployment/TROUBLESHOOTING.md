# 🛠️ Troubleshooting - CRM Ymbale

Guia rápido de resolução de problemas mais comuns.

---

## ⚡ Resolução Rápida por Erro

### 🔴 PM2 não encontrado
```bash
npm install -g pm2
export PATH=$PATH:$(npm config get prefix)/bin
pm2 --version
```

### 🔴 Aplicação não inicia
```bash
# Ver logs
pm2 logs crm-ymbale --err --lines 50

# Verificar build
ls -la .next

# Rebuild se necessário
npm run build
pm2 restart crm-ymbale
```

### 🔴 Porta 3000 em uso
```bash
# Encontrar e parar processo
lsof -i :3000
kill -9 PID

# OU
pkill -f "node.*next"
pm2 restart crm-ymbale
```

### 🔴 Erro de módulo não encontrado
```bash
rm -rf node_modules package-lock.json
npm install
npx prisma generate
npm run build
```

### 🔴 Prisma Client não encontrado
```bash
npx prisma generate
npx prisma db push
npm run build
```

### 🔴 PostgreSQL não conecta
```bash
# Verificar se está rodando
docker compose ps

# Iniciar se necessário
docker compose up -d postgres

# Verificar conexão
docker compose exec postgres psql -U crm_user -d crm_ymbale -c "SELECT 1;"
```

### 🔴 PM2 reinicia constantemente (errored)
```bash
# Ver logs detalhados
pm2 logs crm-ymbale --err --lines 100

# Parar e reiniciar
pm2 delete crm-ymbale
pm2 start ecosystem.config.js
pm2 logs crm-ymbale
```

---

## 🔍 Comandos de Diagnóstico

### Verificar Status Geral
```bash
# PM2
pm2 status
pm2 show crm-ymbale

# Node.js
node --version
npm --version

# Build
ls -la .next

# Porta
lsof -i :3000
```

### Ver Logs
```bash
# Todos os logs
pm2 logs crm-ymbale

# Apenas erros
pm2 logs crm-ymbale --err

# Últimas 50 linhas
pm2 logs crm-ymbale --lines 50

# Em tempo real
pm2 logs crm-ymbale --lines 0
```

### Verificar Processos
```bash
# Processos PM2
pm2 list

# Processos Node.js
ps aux | grep node

# Processos na porta 3000
lsof -i :3000
```

---

## 🔄 Reset Completo (Último Recurso)

```bash
# ⚠️ ATENÇÃO: Isso vai parar e limpar tudo

# 1. Backup
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

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

# 6. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 📋 Checklist de Verificação

Após qualquer correção, verifique:

- [ ] `pm2 status` mostra `online`
- [ ] `pm2 logs crm-ymbale --err` não tem erros
- [ ] Site carrega no navegador
- [ ] Login funciona
- [ ] Banco de dados conecta

---

## 🆘 Precisa de Mais Ajuda?

1. Execute o script de diagnóstico: `~/diagnostico.sh`
2. Veja logs completos: `pm2 logs crm-ymbale --err --lines 100`
3. Consulte [DIAGNOSTICO_ERROS.md](./DIAGNOSTICO_ERROS.md) para análise detalhada

---

**💡 Dica:** 90% dos problemas são resolvidos com:
1. Ver logs (`pm2 logs crm-ymbale --err`)
2. Rebuild (`npm run build`)
3. Reiniciar (`pm2 restart crm-ymbale`)
