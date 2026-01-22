# 🚀 Comandos para Executar na VPS - Deploy

Execute estes comandos na ordem na sua VPS.

---

## ⚠️ IMPORTANTE: Verificar Como a Aplicação Está Rodando

Antes de tudo, verifique como sua aplicação está rodando atualmente:

```bash
# Verificar se está rodando com systemd
systemctl status crm

# Verificar se está rodando com PM2
pm2 status

# Verificar processos Node.js
ps aux | grep node

# Verificar porta 3000
lsof -i :3000
```

---

## 📋 Opção 1: Se Estiver Usando Systemd (DEPLOY_VPS.md)

Se sua aplicação está rodando com `systemctl`, use estes comandos:

```bash
# 1. Backup
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Atualizar código
cd ~/crm-ymbale
git pull origin main

# 3. Dependências
npm install

# 4. Prisma
npx prisma generate
npx prisma db push

# 5. Build
npm run build

# 6. Copiar arquivos estáticos
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# 7. Reiniciar
systemctl restart crm

# 8. Verificar
systemctl status crm
journalctl -u crm -f --lines 20
```

---

## 📋 Opção 2: Instalar e Usar PM2 (Recomendado)

### Passo 1: Instalar PM2

```bash
npm install -g pm2
pm2 --version
```

### Passo 2: Verificar Aplicação Atual

```bash
# Verificar se está rodando
ps aux | grep node
systemctl status crm 2>/dev/null || echo "Systemd não configurado"
```

### Passo 3: Parar Aplicação Atual (se estiver rodando)

```bash
# Se estiver com systemd
systemctl stop crm 2>/dev/null || echo "Serviço não encontrado"

# Se estiver com nohup ou outro método
pkill -f "node.*next" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
```

### Passo 4: Atualizar Código e Dependências

```bash
cd ~/crm-ymbale

# Backup
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# Atualizar código
git pull origin main

# Dependências
npm install
```

### Passo 5: Atualizar Banco de Dados

```bash
npx prisma generate
npx prisma db push
```

### Passo 6: Build

```bash
npm run build
```

### Passo 7: Iniciar com PM2

```bash
# Usar arquivo de configuração (recomendado)
pm2 start ecosystem.config.js

# OU iniciar diretamente
pm2 start npm --name "crm-ymbale" -- start

# Salvar configuração
pm2 save

# Configurar auto-start (execute o comando que aparecer)
pm2 startup
```

### Passo 8: Verificar

```bash
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 🔄 Comandos Rápidos para Atualização (PM2)

Depois de configurar PM2, use este script rápido:

```bash
#!/bin/bash
# deploy-rapido.sh

cd ~/crm-ymbale

# Backup
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# Atualizar
git pull origin main
npm install
npx prisma generate
npx prisma db push
npm run build

# Reiniciar
pm2 restart crm-ymbale

# Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 🔍 Verificar Status da Aplicação

### Com Systemd:
```bash
systemctl status crm
journalctl -u crm -f
```

### Com PM2:
```bash
pm2 status
pm2 logs crm-ymbale
pm2 monit
```

---

## 🐛 Troubleshooting

### PM2 não encontrado
```bash
npm install -g pm2
export PATH=$PATH:/usr/local/bin
pm2 --version
```

### Aplicação não inicia
```bash
# Ver logs
pm2 logs crm-ymbale --err

# Verificar build
ls -la .next

# Rebuild se necessário
npm run build
```

### Porta em uso
```bash
lsof -i :3000
kill -9 PID
```

### Erro: "Cannot find module"
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Script Completo (Copie e Cole)

Execute este bloco completo na VPS:

```bash
# Instalar PM2 (se não tiver)
npm install -g pm2

# Navegar para projeto
cd ~/crm-ymbale

# Backup
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# Atualizar
git pull origin main
npm install
npx prisma generate
npx prisma db push
npm run build

# Parar aplicação antiga (se houver)
systemctl stop crm 2>/dev/null
pkill -f "node.*next" 2>/dev/null

# Iniciar com PM2
pm2 start ecosystem.config.js || pm2 start npm --name "crm-ymbale" -- start
pm2 save
pm2 startup

# Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

**Escolha a opção que corresponde à sua configuração atual!**
