# 🚀 Guia Rápido de Deploy - CRM Ymbale

Guia passo a passo simplificado para fazer deploy na VPS.

---

## ⚡ Deploy Rápido (Atualização)

Se você já tem o sistema rodando na VPS e só quer atualizar:

### 0. Verificar/Instalar PM2 (se necessário)

**Se PM2 não estiver instalado:**
```bash
npm install -g pm2
pm2 --version
```

**Se já estiver instalado, pule para o passo 1.**

**Para mais detalhes, consulte:** [INSTALAR_PM2.md](./INSTALAR_PM2.md)

### 1. Conectar na VPS
```bash
ssh usuario@seu-servidor.com
```

### 2. Navegar para o projeto
```bash
cd ~/crm-ymbale
# OU
cd /root/crm-ymbale
```

### 3. Fazer backup (IMPORTANTE!)
```bash
pg_dump -U crm_user -d crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4. Atualizar código
```bash
git pull origin main
```

### 5. Instalar dependências
```bash
npm install
```

### 6. Atualizar banco de dados
```bash
npx prisma generate
npx prisma db push
```

### 7. Build
```bash
npm run build
```

### 8. Reiniciar aplicação

**Se PM2 não estiver instalado, instale primeiro:**
```bash
npm install -g pm2
```

**Depois reinicie:**
```bash
pm2 restart crm-ymbale

# OU se for a primeira vez, inicie:
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 9. Verificar logs
```bash
pm2 logs crm-ymbale --lines 50
```

### 10. Testar
Acesse o site e verifique se está funcionando!

---

## 📋 Checklist Rápido

Execute estes comandos na ordem:

```bash
# 1. Backup
pg_dump -U crm_user -d crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Atualizar código
git pull origin main

# 3. Dependências
npm install

# 4. Prisma
npx prisma generate
npx prisma db push

# 5. Build
npm run build

# 6. Reiniciar
pm2 restart crm-ymbale

# 7. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 🔍 Verificações Pós-Deploy

Após o deploy, verifique:

1. **Acesse o site** - Deve carregar normalmente
2. **Faça login** - Deve funcionar
3. **Teste `/admin/zonas`** - Deve abrir a página de zonas
4. **Teste `/sellers`** - Deve mostrar executivos e zonas
5. **Teste `/carteira`** - Deve mostrar zonas dos executivos

---

## 🐛 Se Algo Der Errado

### Erro no build
```bash
# Verificar erros
npm run build

# Limpar cache e tentar novamente
rm -rf .next
npm run build
```

### Erro no banco
```bash
# Verificar se tabelas existem
psql -U crm_user -d crm_ymbale -c "\dt zonas_cep"
psql -U crm_user -d crm_ymbale -c "\dt seller_zonas"

# Se não existirem, aplicar schema novamente
npx prisma db push
```

### Aplicação não inicia
```bash
# Ver logs detalhados
pm2 logs crm-ymbale --err

# Verificar se porta está livre
lsof -i :3000

# Reiniciar PM2
pm2 restart crm-ymbale
pm2 save
```

### Rollback (voltar versão anterior)
```bash
# Reverter código
git reset --hard HEAD~1

# Restaurar banco (se necessário)
psql -U crm_user -d crm_ymbale < backup_YYYYMMDD_HHMMSS.sql

# Rebuild e restart
npm run build
pm2 restart crm-ymbale
```

---

## 📝 Após Deploy Bem-Sucedido

### 1. Popular Zonas (se necessário)
1. Acesse `/admin/zonas`
2. Clique em "🌱 Popular Zonas Padrão" (cria 20 zonas de SP)
3. Clique em "🏙️ Adicionar Zonas Sorocaba" (cria 5 zonas de Sorocaba)

### 2. Sincronizar Restaurantes
1. Acesse `/sellers`
2. Clique em "Sincronizar Restaurantes"
3. Isso atribuirá restaurantes aos executivos baseado nas zonas

---

## 💡 Dicas

- **Sempre faça backup antes de atualizar!**
- **Teste localmente primeiro** (se possível)
- **Verifique logs após cada passo**
- **Mantenha o DEPLOYMENT.md completo como referência**

---

**Para mais detalhes, consulte:** [DEPLOYMENT.md](./DEPLOYMENT.md)
