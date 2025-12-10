# 🚀 Comandos para Iniciar Aplicação na VPS

## ⚠️ Situação Atual

O build foi feito com sucesso, mas a aplicação não está rodando no PM2.

## ✅ Solução Rápida (Recomendada)

Execute na VPS:

```bash
cd ~/crm-ymbale
bash iniciar-aplicacao.sh
```

## ✅ Solução Manual (Testada e Funcionando)

Se o script não funcionar, use esta sequência que **já foi testada e funciona**:

```bash
cd ~/crm-ymbale

# 1. Parar TUDO do PM2
pm2 stop all
pm2 delete all

# 2. Matar qualquer processo na porta 3000
lsof -ti:3000 | xargs kill -9

# Ou se o comando acima não funcionar:
fuser -k 3000/tcp

# 3. Verificar se liberou (não deve retornar nada)
lsof -i:3000

# 4. Agora sim, subir de novo
pm2 start npm --name "crm-ymbale" -- start

# 5. Verificar status
pm2 status
pm2 logs crm-ymbale --lines 50
```

## 📋 Verificar se Funcionou

### 1. Verificar Status PM2
```bash
pm2 status
```

Deve mostrar `crm-ymbale` como `online`.

### 2. Verificar Logs
```bash
pm2 logs crm-ymbale --lines 20 --nostream
```

Não deve mostrar erros.

### 3. Verificar Porta 3000
```bash
lsof -i :3000
```

Deve mostrar processo Node rodando.

### 4. Testar Acesso
```bash
curl http://localhost:3000
```

Deve retornar HTML (não erro de conexão).

---

## 🔄 Se Precisar Reiniciar

```bash
pm2 restart crm-ymbale
```

## 🛑 Se Precisar Parar

```bash
pm2 stop crm-ymbale
```

## 📊 Ver Status Completo

```bash
pm2 status
pm2 info crm-ymbale
```

---

**Execute `bash iniciar-aplicacao.sh` na VPS agora!** 🚀

