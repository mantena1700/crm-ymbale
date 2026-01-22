# 📦 Preparar Commit e Atualizar VPS

Guia completo para fazer commit das mudanças e atualizar o CRM na VPS.

---

## 📋 Checklist Antes do Commit

### 1. Verificar Arquivos Modificados
```bash
git status
```

### 2. Verificar se Build Funciona Localmente
```bash
npm run build
```

### 3. Verificar se Não Há Erros de Lint
```bash
npm run lint
```

---

## 🚀 Passo a Passo para Commit

### 1. Adicionar Todos os Arquivos
```bash
# Adicionar todos os arquivos modificados
git add .

# OU adicionar arquivos específicos
git add src/
git add *.md
git add ecosystem.config.js
git add diagnostico.sh
git add atualizar-vps.sh
```

### 2. Fazer Commit
```bash
git commit -m "feat: Adicionar sistema completo de diagnóstico e troubleshooting

- Adicionar DIAGNOSTICO_ERROS.md com guia completo de 12 erros comuns
- Adicionar TROUBLESHOOTING.md com soluções rápidas
- Adicionar script diagnostico.sh para diagnóstico automático
- Adicionar script atualizar-vps.sh para atualização automática na VPS
- Atualizar documentação de deploy com PM2
- Adicionar COMANDOS_VPS_AGORA.md para atualização rápida
- Adicionar ATUALIZAR_VPS.md com guia completo de atualização
- Adicionar PREPARAR_COMMIT.md (este arquivo)
- Melhorar ecosystem.config.js para PM2
- Adicionar guias de instalação e configuração do PM2"
```

### 3. Push para GitHub
```bash
git push origin main
```

---

## 📝 Mensagem de Commit Sugerida (Alternativa)

Se preferir uma mensagem mais curta:

```
feat: Sistema completo de diagnóstico e troubleshooting

- Adicionar DIAGNOSTICO_ERROS.md (guia completo de 12 erros comuns)
- Adicionar TROUBLESHOOTING.md (soluções rápidas)
- Adicionar diagnostico.sh (script automático de diagnóstico)
- Adicionar atualizar-vps.sh (script de atualização automática)
- Atualizar DEPLOY_COMANDOS_VPS.md com PM2
- Adicionar INSTALAR_PM2.md (guia de instalação)
- Adicionar COMANDOS_VPS_AGORA.md (script de atualização)
- Adicionar ATUALIZAR_VPS.md (guia completo)
- Adicionar PREPARAR_COMMIT.md (este arquivo)
- Melhorar ecosystem.config.js
```

---

## 🔄 Atualizar na VPS

Após fazer commit e push, use o script de atualização na VPS:

```bash
# Na VPS, execute:
cd ~/crm-ymbale
bash atualizar-vps.sh
```

OU siga o guia em `ATUALIZAR_VPS.md` ou `COMANDOS_VPS_AGORA.md`

---

## ✅ Verificação Pós-Commit

1. Verificar se push foi bem-sucedido:
   ```bash
   git log --oneline -1
   ```

2. Verificar no GitHub se arquivos foram enviados

3. Na VPS, verificar se atualização funcionou:
   ```bash
   pm2 status
   pm2 logs crm-ymbale --lines 20
   ```

---

## 🆘 Se Algo Der Errado

### Erro no Commit
```bash
# Verificar status
git status

# Desfazer último commit (mantém mudanças)
git reset --soft HEAD~1

# Tentar novamente
git commit -m "sua mensagem"
```

### Erro no Push
```bash
# Verificar remoto
git remote -v

# Forçar push (cuidado!)
git push origin main --force
```

---

## 📦 Arquivos que Serão Commitados

- ✅ `DIAGNOSTICO_ERROS.md` - Guia completo de diagnóstico
- ✅ `TROUBLESHOOTING.md` - Soluções rápidas
- ✅ `diagnostico.sh` - Script de diagnóstico automático
- ✅ `atualizar-vps.sh` - Script de atualização automática
- ✅ `PREPARAR_COMMIT.md` - Este arquivo
- ✅ `ATUALIZAR_VPS.md` - Guia de atualização
- ✅ `COMANDOS_VPS_AGORA.md` - Comandos rápidos
- ✅ `INSTALAR_PM2.md` - Guia de instalação PM2
- ✅ `ecosystem.config.js` - Configuração PM2
- ✅ Atualizações em outros arquivos de documentação

---

**Pronto para commit! Execute os comandos acima na ordem.**
