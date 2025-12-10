# 🔧 Solução: Porta 80 em Uso

## 🔍 Problema

O erro `bind() to 0.0.0.0:80 failed (98: Unknown error)` indica que a porta 80 já está em uso por outro processo.

## ⚡ Solução Rápida

Execute estes comandos na VPS:

```bash
# 1. Verificar o que está usando a porta 80
lsof -i :80
# ou
netstat -tulpn | grep :80
# ou
ss -tulpn | grep :80

# 2. Parar Nginx
systemctl stop nginx

# 3. Verificar se há outros processos na porta 80
lsof -i :80

# 4. Se houver outros processos, parar
# (Substitua PID pelo número do processo)
kill -9 PID

# 5. Verificar configuração do Nginx
nginx -t

# 6. Iniciar Nginx
systemctl start nginx

# 7. Verificar status
systemctl status nginx

# 8. Tentar Certbot novamente
certbot --nginx -d app.domseven.com.br
```

## 🔍 Diagnóstico Detalhado

### Verificar Processos na Porta 80

```bash
# Método 1: lsof
lsof -i :80

# Método 2: netstat
netstat -tulpn | grep :80

# Método 3: ss
ss -tulpn | grep :80

# Método 4: fuser
fuser 80/tcp
```

### Verificar Múltiplas Instâncias do Nginx

```bash
# Ver processos do Nginx
ps aux | grep nginx

# Ver quantas instâncias estão rodando
ps aux | grep nginx | grep -v grep | wc -l

# Ver processos master e worker
ps aux | grep nginx | grep -E "master|worker"
```

### Parar Todos os Processos do Nginx

```bash
# Parar via systemd
systemctl stop nginx

# Se não funcionar, parar processos manualmente
pkill -9 nginx

# Verificar se parou
ps aux | grep nginx
```

## 🐛 Problemas Comuns

### Problema: Apache está rodando na porta 80

```bash
# Verificar se Apache está instalado
systemctl status apache2

# Parar Apache
systemctl stop apache2
systemctl disable apache2

# Iniciar Nginx
systemctl start nginx
```

### Problema: Outro servidor web está rodando

```bash
# Verificar todos os serviços web
systemctl list-units | grep -E "nginx|apache|httpd"

# Parar serviços desnecessários
systemctl stop apache2
systemctl stop httpd
```

### Problema: Processo "fantasma" na porta 80

```bash
# Encontrar PID do processo
lsof -i :80 | awk 'NR==2 {print $2}'

# Parar processo
kill -9 PID

# OU parar todos processos na porta 80
fuser -k 80/tcp
```

### Problema: Nginx não inicia após parar

```bash
# Verificar logs de erro
journalctl -xeu nginx.service -n 50

# Verificar configuração
nginx -t

# Verificar se há erros de sintaxe
cat /etc/nginx/sites-enabled/crm

# Tentar iniciar manualmente para ver erro
nginx -g "daemon off;"
```

## ✅ Solução Completa (Script)

Execute o script que criei:

```bash
cd ~/crm-ymbale
bash corrigir-porta-80.sh
```

Depois execute novamente:

```bash
certbot --nginx -d app.domseven.com.br
```

## 🔄 Passo a Passo Manual

1. **Parar Nginx:**
   ```bash
   systemctl stop nginx
   ```

2. **Verificar porta 80:**
   ```bash
   lsof -i :80
   ```

3. **Se houver outros processos, parar:**
   ```bash
   kill -9 PID
   ```

4. **Verificar configuração:**
   ```bash
   nginx -t
   ```

5. **Iniciar Nginx:**
   ```bash
   systemctl start nginx
   ```

6. **Verificar status:**
   ```bash
   systemctl status nginx
   ```

7. **Executar Certbot novamente:**
   ```bash
   certbot --nginx -d app.domseven.com.br
   ```

## 📝 Verificação Final

Após corrigir, verifique:

```bash
# 1. Nginx está rodando
systemctl status nginx

# 2. Porta 80 está em uso pelo Nginx
lsof -i :80 | grep nginx

# 3. Nginx responde
curl -I http://localhost

# 4. Certbot funciona
certbot --nginx -d app.domseven.com.br
```

---

**Execute os comandos acima e depois tente o Certbot novamente!** 🎯

