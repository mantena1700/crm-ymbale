# 🔍 Como Verificar se Otimizações Mobile Estão Ativas

## ✅ Verificação Rápida

### 1. No Celular (Chrome DevTools)

1. Abra o site no celular
2. No Chrome, vá em **Menu > Mais ferramentas > Ferramentas do desenvolvedor**
3. Ou acesse: `chrome://inspect` no computador e conecte o celular

### 2. Verificar Service Worker

No console do navegador (F12), execute:

```javascript
// Verificar se Service Worker está registrado
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers:', registrations.length);
  registrations.forEach(reg => console.log(reg.scope));
});

// Verificar se está instalado como PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('✅ Rodando como PWA');
} else {
  console.log('❌ NÃO está como PWA');
}
```

### 3. Verificar Arquivos

No console do navegador:

```javascript
// Verificar se CSS mobile está carregado
const styles = Array.from(document.styleSheets);
const mobileCSS = styles.find(sheet => 
  sheet.href && sheet.href.includes('mobile-optimizations')
);
console.log('Mobile CSS:', mobileCSS ? '✅ Carregado' : '❌ Não encontrado');
```

### 4. Verificar Gestos Swipe

1. No celular, tente fazer swipe da **esquerda para direita** (da borda da tela)
2. O menu deve abrir
3. Com menu aberto, swipe da **direita para esquerda**
4. O menu deve fechar

### 5. Verificar Touch Targets

1. Todos os botões devem ter pelo menos **48px de altura**
2. Inputs devem ter **font-size 16px** (não fazem zoom no iOS)

---

## 🔧 Verificação na VPS

Execute na VPS:

```bash
cd ~/crm-ymbale
bash verificar-atualizacao.sh
```

Isso vai mostrar:
- ✅ Se arquivos mobile existem
- ✅ Se estão no build
- ✅ Se Service Worker está acessível
- ✅ Se aplicação está rodando

---

## 🐛 Problemas Comuns

### Problema: Service Worker não registra

**Solução:**
1. Verificar se está em HTTPS (obrigatório para SW)
2. Limpar cache do navegador
3. Verificar se `sw.js` está em `/public/`

### Problema: Gestos swipe não funcionam

**Solução:**
1. Verificar se `MobileOptimizations.tsx` está no build
2. Verificar console para erros JavaScript
3. Testar em navegador diferente

### Problema: CSS mobile não aplica

**Solução:**
1. Verificar se `mobile-optimizations.css` está importado no `layout.tsx`
2. Limpar cache do navegador (Ctrl+Shift+R)
3. Verificar se build foi feito após adicionar CSS

---

## 📱 Testar como PWA

### iOS (Safari):
1. Abra o site
2. Toque no botão **Compartilhar**
3. Toque em **Adicionar à Tela de Início**
4. Abra o app da tela de início
5. Deve abrir sem barra de navegação (standalone)

### Android (Chrome):
1. Abra o site
2. Toque no menu (3 pontos)
3. Toque em **Adicionar à tela inicial**
4. Abra o app da tela inicial
5. Deve abrir como app

---

## ✅ Checklist de Verificação

- [ ] Service Worker registrado (console)
- [ ] CSS mobile carregado (Network tab)
- [ ] Gestos swipe funcionam
- [ ] Botões têm 48px mínimo
- [ ] Inputs não fazem zoom (iOS)
- [ ] Pode instalar como PWA
- [ ] Modais ocupam tela inteira
- [ ] Tabelas fazem scroll horizontal

---

**Execute `bash verificar-atualizacao.sh` na VPS para diagnóstico completo!**

