# ⚡ Comandos para Executar AGORA na VPS

**Execute estes comandos na ordem na sua VPS:**

---

## 🚀 Script Completo (Copie e Cole Tudo)

```bash
# 1. Instalar PM2
npm install -g pm2

# 2. Navegar para o projeto
cd ~/crm-ymbale

# 3. Backup do banco
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Atualizar código do GitHub
git pull origin main

# 5. Instalar dependências
npm install

# 6. Atualizar Prisma
npx prisma generate
npx prisma db push

# 7. Build
npm run build

# 8. Parar aplicação antiga (se estiver rodando)
systemctl stop crm 2>/dev/null || echo "Systemd não encontrado"
pkill -f "node.*next" 2>/dev/null || echo "Processo não encontrado"

# 9. Iniciar com PM2
pm2 start ecosystem.config.js

# 10. Salvar e configurar auto-start
pm2 save
pm2 startup
# (Execute o comando que aparecer na tela)

# 11. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## ✅ Verificar se Funcionou

Após executar os comandos acima:

1. **Verifique o status:**
   ```bash
   pm2 status
   ```
   Deve mostrar `crm-ymbale` com status `online`

2. **Verifique os logs:**
   ```bash
   pm2 logs crm-ymbale --lines 30
   ```
   Deve mostrar "Ready" e não deve ter erros

3. **Acesse o site no navegador:**
   - Deve carregar normalmente
   - Faça login
   - Teste `/admin/zonas`
   - Teste `/sellers`

---

## 🐛 Se Der Erro

### Erro: "pm2: command not found"
```bash
# Instalar PM2 novamente
npm install -g pm2

# Verificar instalação
which pm2
pm2 --version
```

### Erro: "Cannot find module"
```bash
# Reinstalar dependências
rm -rf node_modules
npm install
```

### Erro: "Port 3000 already in use"
```bash
# Ver qual processo está usando
lsof -i :3000

# Parar processo
kill -9 PID

# Tentar iniciar novamente
pm2 restart crm-ymbale
```

### Erro no build
```bash
# Limpar e rebuild
rm -rf .next
npm run build
```

### Erro: "ecosystem.config.js not found"
```bash
# Verificar se arquivo existe
ls -la ecosystem.config.js

# Se não existir, criar manualmente ou usar comando direto:
pm2 start npm --name "crm-ymbale" -- start
```

---

## 📋 Próximos Passos Após Deploy

1. **Popular Zonas:**
   - Acesse `/admin/zonas`
   - Clique em "🌱 Popular Zonas Padrão"
   - Clique em "🏙️ Adicionar Zonas Sorocaba"

2. **Sincronizar Restaurantes:**
   - Acesse `/sellers`
   - Clique em "Sincronizar Restaurantes"

---

**Execute o script completo acima e me avise se funcionou!**
