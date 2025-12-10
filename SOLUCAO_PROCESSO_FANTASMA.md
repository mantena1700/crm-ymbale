# 🔍 Solução: Processo Next.js Fantasma na Porta 80

## ❌ O Problema

O certificado SSL não conseguia ser instalado porque o **Nginx não conseguia iniciar**.

### Erro apresentado:
```
nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Unknown error)
nginx: [emerg] still could not bind()
```

---

## 🎯 Causa Raiz

**Dois processos Next.js estavam rodando simultaneamente:**

| Processo | PID | Porta | Status |
|----------|-----|-------|--------|
| Next.js (fantasma) | 465331 | **80** | ❌ Bloqueando o Nginx |
| Next.js (PM2) | 465662 | **3000** | ✅ Correto |

### Por que isso aconteceu?

1. O Next.js foi iniciado **manualmente** na porta 80 em algum momento
2. Depois foi configurado no **PM2** para rodar na porta 3000
3. O processo antigo (porta 80) **não foi encerrado** e ficou "fantasma"
4. Quando tentamos iniciar o Nginx, ele não conseguiu porque a porta 80 já estava ocupada

---

## ✅ Solução

```bash
# 1. Matar o processo que está ocupando a porta 80
sudo kill -9 465331

# 2. Verificar se a porta está livre
sudo lsof -i :80

# 3. Iniciar o Nginx
sudo systemctl start nginx

# 4. Instalar o certificado SSL
sudo certbot --nginx -d app.domseven.com.br
```

---

## 📋 Arquitetura Correta

```
Internet (porta 80/443)
         ↓
    Nginx (proxy reverso)
         ↓
   Next.js (porta 3000)
```

### Como deve funcionar:
- **Nginx**: Escuta nas portas 80 (HTTP) e 443 (HTTPS)
- **Next.js**: Roda na porta 3000 (interna)
- **Certbot**: Configura automaticamente o SSL no Nginx

---

## 🛡️ Prevenção

Para evitar esse problema no futuro:

```bash
# Sempre verificar se há processos fantasmas
sudo lsof -i :80
sudo netstat -tlnp | grep :80

# Sempre usar PM2 para gerenciar a aplicação
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Nunca rodar Next.js diretamente na porta 80
# SEMPRE use: PORT=3000 npm start
```

---

## 📝 Comandos Úteis

```bash
# Ver o que está usando a porta 80
sudo lsof -i :80

# Ver processos gerenciados pelo PM2
pm2 list

# Ver TODOS processos Node/Next
ps aux | grep -E "node|next" | grep -v grep

# Parar todos processos Next.js
pkill -9 next-server
pkill -9 node

# Reiniciar Nginx
sudo systemctl restart nginx

# Ver logs do Certbot
tail -50 /var/log/letsencrypt/letsencrypt.log
```

---

## 🔧 Script de Verificação Preventiva

Execute antes de fazer deploy/atualizações:

```bash
# Verificar processos na porta 80
echo "=== Processos na porta 80 ==="
lsof -i :80 || echo "Porta 80 livre"

# Verificar processos na porta 3000
echo "=== Processos na porta 3000 ==="
lsof -i :3000 || echo "Porta 3000 livre"

# Verificar PM2
echo "=== Processos PM2 ==="
pm2 list

# Verificar processos Node/Next
echo "=== Processos Node/Next ==="
ps aux | grep -E "node|next" | grep -v grep
```

---

## 🚨 Checklist Antes de Configurar SSL

Antes de executar `certbot --nginx`, sempre verifique:

- [ ] Porta 80 está livre (`lsof -i :80` não mostra nada)
- [ ] Aplicação está rodando na porta 3000 (`lsof -i :3000` mostra node)
- [ ] Nginx está rodando (`systemctl status nginx`)
- [ ] Não há processos "fantasma" (`ps aux | grep next-server`)

---

## 💡 Dica Importante

**SEMPRE use PM2 para gerenciar a aplicação Next.js!**

Nunca execute:
```bash
# ❌ ERRADO - Pode criar processo fantasma
npm start
# ou
node server.js
```

Sempre use:
```bash
# ✅ CORRETO - Gerenciado pelo PM2
pm2 start ecosystem.config.js
pm2 save
```

---

**Problema resolvido! Agora você sabe como evitar no futuro.** 🎯

