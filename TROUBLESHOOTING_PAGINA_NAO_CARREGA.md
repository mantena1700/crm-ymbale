# 🐛 Página Não Carrega - Troubleshooting

Guia para resolver quando a página fica carregando infinitamente.

---

## ⚡ Diagnóstico Rápido

Execute estes comandos na VPS para identificar o problema:

```bash
# 1. Verificar se aplicação está rodando
pm2 status

# 2. Ver logs de erro detalhados
pm2 logs crm-ymbale --err --lines 50

# 3. Ver todos os logs
pm2 logs crm-ymbale --lines 100

# 4. Verificar se porta está acessível
curl http://localhost:3000

# 5. Verificar processos Node
ps aux | grep node
```

---

## 🔴 Problemas Comuns e Soluções

### 1. Aplicação não está respondendo

**Sintoma:** Página fica carregando, sem resposta.

**Solução:**
```bash
# Ver logs detalhados
pm2 logs crm-ymbale --err --lines 100

# Reiniciar aplicação
pm2 restart crm-ymbale

# Se não funcionar, parar e iniciar novamente
pm2 delete crm-ymbale
pm2 start ecosystem.config.js
pm2 save
```

---

### 2. Erro de conexão com banco de dados

**Sintoma:** Página carrega mas não conecta ao banco.

**Solução:**
```bash
# Verificar se PostgreSQL está rodando
docker compose ps

# Se não estiver, iniciar
docker compose up -d postgres

# Verificar conexão
docker compose exec postgres psql -U crm_user -d crm_ymbale -c "SELECT 1;"

# Verificar .env
cat .env | grep DATABASE_URL
```

---

### 3. Erro no build ou módulos faltando

**Sintoma:** Erros no console do navegador ou logs.

**Solução:**
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install

# Regenerar Prisma
npx prisma generate

# Rebuild
npm run build

# Reiniciar
pm2 restart crm-ymbale
```

---

### 4. Porta 3000 bloqueada ou em conflito

**Sintoma:** Não consegue conectar na porta 3000.

**Solução:**
```bash
# Verificar se porta está em uso
lsof -i :3000
netstat -tulpn | grep :3000

# Verificar firewall
ufw status

# Se necessário, liberar porta
ufw allow 3000/tcp
```

---

### 5. Erro de memória ou CPU

**Sintoma:** Aplicação trava ou fica lenta.

**Solução:**
```bash
# Ver uso de recursos
pm2 monit

# Verificar memória
free -h

# Se necessário, aumentar limite no ecosystem.config.js
# max_memory_restart: '2G'
```

---

### 6. Erro no Next.js (hydration, build)

**Sintoma:** Erros no console do navegador relacionados a React/Next.js.

**Solução:**
```bash
# Limpar cache do Next.js
rm -rf .next

# Rebuild completo
npm run build

# Reiniciar
pm2 restart crm-ymbale
```

---

## 🔍 Diagnóstico Passo a Passo

### Passo 1: Verificar Status do PM2
```bash
pm2 status
```
**Esperado:** Status `online` (não `errored` ou `stopped`)

### Passo 2: Ver Logs de Erro
```bash
pm2 logs crm-ymbale --err --lines 50
```
**Procure por:**
- Erros de conexão com banco
- Erros de módulos não encontrados
- Erros de build
- Erros de memória

### Passo 3: Testar Localmente na VPS
```bash
curl http://localhost:3000
```
**Esperado:** Retornar HTML (não erro de conexão)

### Passo 4: Verificar Banco de Dados
```bash
docker compose exec postgres psql -U crm_user -d crm_ymbale -c "SELECT COUNT(*) FROM users;"
```
**Esperado:** Retornar um número (não erro)

### Passo 5: Verificar Build
```bash
ls -la .next
ls -la .next/standalone
```
**Esperado:** Diretórios existem e têm conteúdo

---

## 🚨 Solução de Emergência

Se nada funcionar, faça um reset completo:

```bash
# 1. Backup do banco
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_emergencia_$(date +%Y%m%d_%H%M%S).sql

# 2. Parar tudo
pm2 delete all
pkill -f node

# 3. Limpar
rm -rf .next node_modules package-lock.json

# 4. Reinstalar
npm install
npx prisma generate
npx prisma db push
npm run build

# 5. Reiniciar
pm2 start ecosystem.config.js
pm2 save

# 6. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 📋 Checklist de Verificação

Após aplicar qualquer solução, verifique:

- [ ] `pm2 status` mostra `online`
- [ ] `pm2 logs crm-ymbale --err` não tem erros
- [ ] `curl http://localhost:3000` retorna HTML
- [ ] PostgreSQL está rodando (`docker compose ps`)
- [ ] Build existe (`ls -la .next`)
- [ ] Site carrega no navegador

---

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
pm2 logs crm-ymbale

# Monitorar recursos
pm2 monit

# Ver informações detalhadas
pm2 show crm-ymbale

# Reiniciar
pm2 restart crm-ymbale

# Recarregar (zero downtime)
pm2 reload crm-ymbale
```

---

## 🆘 Se Ainda Não Funcionar

1. **Execute o diagnóstico completo:**
   ```bash
   bash diagnostico.sh
   ```

2. **Consulte os logs completos:**
   ```bash
   pm2 logs crm-ymbale --lines 200
   ```

3. **Verifique o console do navegador:**
   - Abra DevTools (F12)
   - Vá na aba Console
   - Veja se há erros JavaScript

4. **Verifique a aba Network:**
   - Veja quais requisições estão falhando
   - Verifique status codes (404, 500, etc.)

---

**💡 Dica:** 90% dos problemas de "página não carrega" são resolvidos com:
1. Ver logs (`pm2 logs crm-ymbale --err`)
2. Reiniciar aplicação (`pm2 restart crm-ymbale`)
3. Verificar banco de dados (`docker compose ps`)
