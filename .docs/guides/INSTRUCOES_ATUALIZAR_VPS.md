# 📱 Instruções para Atualizar VPS com Otimizações Mobile

## ⚠️ IMPORTANTE: Os arquivos mobile ainda não foram commitados!

Você precisa fazer commit e push ANTES de atualizar a VPS.

---

## 🔄 Passo 1: Fazer Commit Local (Execute AGORA)

Execute no seu computador:

```bash
cd c:\Users\Bel\Documents\CRM_Ymbale\crm-ymbale

# Adicionar todos os arquivos mobile
git add src/app/mobile-optimizations.css
git add src/components/ServiceWorkerRegistration.tsx
git add src/components/MobileOptimizations.tsx
git add public/sw.js
git add public/manifest.json
git add src/app/layout.tsx
git add src/components/Sidebar.tsx
git add src/components/Sidebar.module.css

# Fazer commit
git commit -m "feat: Adicionar otimizações mobile completas

- Service Worker para PWA offline
- CSS mobile otimizado (safe area, touch targets, etc)
- Gestos swipe na Sidebar
- Meta tags PWA avançadas
- Componentes de otimização mobile
- Manifest.json atualizado com shortcuts"

# Enviar para GitHub
git push origin main
```

---

## 🚀 Passo 2: Atualizar VPS

Depois do push, execute na VPS:

```bash
cd ~/crm-ymbale
bash atualizar-simples.sh
```

OU manualmente:

```bash
cd ~/crm-ymbale
git fetch origin main
git reset --hard origin/main
git clean -fd
npm install
npx prisma generate
npx prisma db push
npm run build
cp -r public .next/standalone/ 2>/dev/null || true
mkdir -p .next/standalone/.next 2>/dev/null || true
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
pm2 stop crm-ymbale 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

---

## ✅ Passo 3: Verificar se Funcionou

Execute na VPS:

```bash
cd ~/crm-ymbale
bash verificar-atualizacao.sh
```

Isso vai mostrar se:
- ✅ Arquivos mobile existem
- ✅ Service Worker está acessível
- ✅ Build foi feito corretamente

---

## 📱 Passo 4: Testar no Celular

1. **Limpar cache do navegador** (importante!)
   - Chrome: Menu > Configurações > Privacidade > Limpar dados de navegação
   - Safari: Configurações > Safari > Limpar histórico e dados

2. **Acessar o site**
   - https://app.domseven.com.br

3. **Verificar Service Worker**
   - Abrir DevTools (F12)
   - Ir em Application > Service Workers
   - Deve mostrar "crm-ymbale-v1" registrado

4. **Testar gestos swipe**
   - Swipe da esquerda: abre menu
   - Swipe da direita: fecha menu

5. **Verificar touch targets**
   - Botões devem ter pelo menos 48px
   - Inputs não devem fazer zoom no iOS

---

## 🐛 Se Não Funcionar

### Problema: Service Worker não registra

**Solução:**
1. Verificar se está em HTTPS (obrigatório)
2. Limpar cache completamente
3. Verificar se `sw.js` existe em `/public/`

### Problema: CSS mobile não aplica

**Solução:**
1. Limpar cache (Ctrl+Shift+R)
2. Verificar se `mobile-optimizations.css` está importado no `layout.tsx`
3. Verificar console para erros

### Problema: Gestos não funcionam

**Solução:**
1. Verificar console para erros JavaScript
2. Verificar se `MobileOptimizations.tsx` está no build
3. Testar em navegador diferente

---

## 📋 Checklist Final

- [ ] Commit feito localmente
- [ ] Push para GitHub feito
- [ ] VPS atualizada com `atualizar-simples.sh`
- [ ] Build feito com sucesso
- [ ] PM2 reiniciado
- [ ] Cache do navegador limpo
- [ ] Service Worker registrado
- [ ] Gestos swipe funcionam
- [ ] CSS mobile aplicado

---

**Execute o Passo 1 AGORA para fazer commit e push!** 🚀

