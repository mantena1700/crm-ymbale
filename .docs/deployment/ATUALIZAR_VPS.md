# 🔄 Atualizar CRM na VPS - Guia Completo

Guia passo a passo para atualizar o CRM na VPS com todas as mudanças.

---

## ⚡ Atualização Rápida (Recomendado)

### Opção 1: Script Automático

```bash
# Na VPS, execute:
cd ~/crm-ymbale
bash atualizar-vps.sh
```

Este script faz tudo automaticamente:
- ✅ Backup do banco
- ✅ Atualiza código do GitHub
- ✅ Instala dependências
- ✅ Atualiza Prisma
- ✅ Faz build
- ✅ Reinicia aplicação

---

### Opção 2: Manual (Passo a Passo)

```bash
# 1. Navegar para o projeto
cd ~/crm-ymbale

# 2. Backup do banco
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Atualizar código
git pull origin main

# 4. Instalar dependências
npm install

# 5. Atualizar Prisma
npx prisma generate
npx prisma db push

# 6. Build
npm run build

# 7. Parar aplicação antiga
pm2 stop crm-ymbale

# 8. Reiniciar
pm2 restart crm-ymbale

# 9. Verificar
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 📋 Checklist de Atualização

Antes de atualizar, verifique:

- [ ] Backup do banco foi feito
- [ ] Código foi commitado e enviado para GitHub
- [ ] Você tem acesso SSH à VPS
- [ ] PM2 está instalado na VPS

---

## 🚀 Processo Completo

### 1. No Seu Computador (Local)

```bash
# 1. Verificar mudanças
git status

# 2. Adicionar arquivos
git add .

# 3. Fazer commit
git commit -m "feat: Adicionar sistema de diagnóstico e troubleshooting"

# 4. Enviar para GitHub
git push origin main
```

### 2. Na VPS

```bash
# Executar script de atualização
cd ~/crm-ymbale
bash atualizar-vps.sh
```

---

## 🔍 Verificação Pós-Atualização

Após atualizar, verifique:

1. **Status do PM2:**
   ```bash
   pm2 status
   ```
   Deve mostrar `online`

2. **Logs sem erros:**
   ```bash
   pm2 logs crm-ymbale --err --lines 20
   ```

3. **Site acessível:**
   - Acesse no navegador
   - Faça login
   - Teste funcionalidades

4. **Novos arquivos presentes:**
   ```bash
   ls -la diagnostico.sh
   ls -la DIAGNOSTICO_ERROS.md
   ls -la TROUBLESHOOTING.md
   ls -la atualizar-vps.sh
   ```

---

## 🐛 Se Algo Der Errado

### Erro: "git pull failed"
```bash
# Verificar conexão
ping github.com

# Verificar remoto
git remote -v

# Tentar novamente
git pull origin main
```

### Erro: "npm install failed"
```bash
# Limpar e tentar novamente
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Build failed"
```bash
# Ver logs detalhados
npm run build

# Limpar e rebuild
rm -rf .next
npm run build
```

### Erro: "PM2 não encontrado"
```bash
# Instalar PM2
npm install -g pm2

# Tentar novamente
bash atualizar-vps.sh
```

### Aplicação não inicia
```bash
# Ver logs de erro
pm2 logs crm-ymbale --err --lines 50

# Executar diagnóstico
bash diagnostico.sh

# Consultar troubleshooting
cat TROUBLESHOOTING.md
```

---

## 📝 Arquivos Importantes Adicionados

Após atualizar, você terá:

- ✅ `diagnostico.sh` - Script de diagnóstico automático
- ✅ `atualizar-vps.sh` - Script de atualização automática
- ✅ `DIAGNOSTICO_ERROS.md` - Guia completo de erros
- ✅ `TROUBLESHOOTING.md` - Soluções rápidas
- ✅ `PREPARAR_COMMIT.md` - Guia de commit
- ✅ `ATUALIZAR_VPS.md` - Este arquivo
- ✅ `COMANDOS_VPS_AGORA.md` - Comandos rápidos
- ✅ `INSTALAR_PM2.md` - Guia de instalação PM2
- ✅ `ecosystem.config.js` - Configuração PM2

---

## 💡 Dicas

1. **Sempre faça backup antes de atualizar**
2. **Execute o diagnóstico após atualizar** (`bash diagnostico.sh`)
3. **Mantenha os scripts atualizados** (faça `git pull` regularmente)
4. **Monitore os logs** após atualização

---

## 🆘 Precisa de Ajuda?

1. Execute o diagnóstico: `bash diagnostico.sh`
2. Consulte `TROUBLESHOOTING.md` para soluções rápidas
3. Consulte `DIAGNOSTICO_ERROS.md` para análise detalhada

---

**Pronto para atualizar! Execute `bash atualizar-vps.sh` na VPS.**
