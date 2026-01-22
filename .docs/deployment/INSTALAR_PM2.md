# 🔧 Instalar e Configurar PM2 na VPS

Guia para instalar PM2 e configurar a aplicação na VPS.

---

## 📋 Instalar PM2

### Opção 1: Instalar globalmente com npm (Recomendado)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Verificar instalação
pm2 --version
```

### Opção 2: Instalar com npx (sem instalação global)

```bash
# Usar npx (já vem com Node.js)
npx pm2 --version
```

---

## 🚀 Configurar Aplicação com PM2

### 1. Navegar para o diretório do projeto

```bash
cd ~/crm-ymbale
# OU
cd /root/crm-ymbale
```

### 2. Verificar se a aplicação já está rodando

```bash
# Verificar processos Node.js
ps aux | grep node

# Verificar se porta 3000 está em uso
lsof -i :3000
# OU
netstat -tulpn | grep :3000
```

### 3. Parar aplicação atual (se estiver rodando)

```bash
# Se estiver rodando com npm start em background
pkill -f "node.*next"

# OU se estiver rodando com systemd
systemctl stop crm

# OU se estiver rodando com nohup
ps aux | grep "node.*server.js"
kill -9 PID
```

### 4. Iniciar aplicação com PM2

```bash
# Opção 1: Iniciar diretamente
pm2 start npm --name "crm-ymbale" -- start

# Opção 2: Usar npx se PM2 não estiver global
npx pm2 start npm --name "crm-ymbale" -- start

# Opção 3: Usar arquivo ecosystem.config.js (recomendado)
pm2 start ecosystem.config.js
```

### 5. Salvar configuração do PM2

```bash
# Salvar lista de processos
pm2 save

# Configurar para iniciar automaticamente no boot
pm2 startup
# (Siga as instruções que aparecerem - geralmente copie e execute o comando sugerido)
```

---

## 📝 Usar Arquivo de Configuração PM2 (Recomendado)

O arquivo `ecosystem.config.js` já foi criado na raiz do projeto.

Para usar:

```bash
# Iniciar com o arquivo de configuração
pm2 start ecosystem.config.js

# Salvar
pm2 save

# Configurar auto-start
pm2 startup
```

---

## 🔍 Comandos PM2 Úteis

### Gerenciar Aplicação

```bash
# Iniciar
pm2 start crm-ymbale

# Parar
pm2 stop crm-ymbale

# Reiniciar
pm2 restart crm-ymbale

# Recarregar (zero downtime)
pm2 reload crm-ymbale

# Deletar
pm2 delete crm-ymbale
```

### Verificar Status

```bash
# Status geral
pm2 status

# Informações detalhadas
pm2 show crm-ymbale

# Monitor em tempo real
pm2 monit
```

### Ver Logs

```bash
# Últimas 50 linhas
pm2 logs crm-ymbale --lines 50

# Apenas erros
pm2 logs crm-ymbale --err

# Logs em tempo real
pm2 logs crm-ymbale

# Limpar logs
pm2 flush
```

---

## 🔄 Atualizar Aplicação com PM2

Após instalar PM2, use este fluxo para atualizar:

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

# 6. Reiniciar com PM2
pm2 restart crm-ymbale

# 7. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 🐛 Troubleshooting

### PM2 não encontrado após instalação

```bash
# Verificar se está no PATH
which pm2

# Se não estiver, adicionar ao PATH
export PATH=$PATH:/usr/local/bin

# OU usar npx
npx pm2 status
```

### Aplicação não inicia

```bash
# Ver logs de erro
pm2 logs crm-ymbale --err

# Verificar se build foi feito
ls -la .next

# Se não tiver .next, fazer build
npm run build
```

### Porta 3000 já em uso

```bash
# Verificar qual processo está usando
lsof -i :3000

# Parar processo
kill -9 PID

# OU usar outra porta no ecosystem.config.js
```

### Migrar de systemd para PM2

Se você estava usando systemd (como no DEPLOY_VPS.md):

```bash
# 1. Parar serviço systemd
systemctl stop crm
systemctl disable crm

# 2. Instalar PM2
npm install -g pm2

# 3. Iniciar com PM2
cd /root/crm-ymbale
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📋 Checklist Pós-Instalação

- [ ] PM2 instalado (`pm2 --version`)
- [ ] Aplicação iniciada (`pm2 start`)
- [ ] Configuração salva (`pm2 save`)
- [ ] Auto-start configurado (`pm2 startup`)
- [ ] Status verificado (`pm2 status`)
- [ ] Logs verificados (`pm2 logs`)
- [ ] Site acessível no navegador

---

## 💡 Dicas

- **PM2 é melhor que systemd** para aplicações Node.js
- **Use `pm2 reload`** ao invés de `restart` para zero downtime
- **Monitore com `pm2 monit`** para ver CPU e memória em tempo real
- **Logs são salvos automaticamente** em `./logs/` (se configurado)

---

**Próximo passo:** Após instalar PM2, siga o [DEPLOY_GUIA_RAPIDO.md](./DEPLOY_GUIA_RAPIDO.md) para fazer o deploy.
