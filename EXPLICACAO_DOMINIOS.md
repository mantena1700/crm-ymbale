# 📚 Explicação: Domínios Separados vs Único Domínio

## ❓ Pergunta: Precisa de domínios separados?

**Resposta: NÃO!** O Next.js é uma aplicação **full-stack** que já inclui backend e frontend.

---

## 🏗️ Arquitetura do Next.js

O Next.js já tem:

### Backend Integrado:
- ✅ **Server Actions** - Funções server-side
- ✅ **API Routes** - Endpoints REST (`/api/*`)
- ✅ **Server Components** - Componentes renderizados no servidor

### Frontend:
- ✅ **Client Components** - Componentes React no navegador
- ✅ **Páginas** - Rotas da aplicação

**Tudo roda na mesma aplicação na porta 3000!**

---

## 📋 Estrutura do Seu CRM

```
app.domseven.com.br (porta 80/443)
    ↓
Nginx (reverse proxy)
    ↓
Next.js na porta 3000
    ├── Frontend (páginas React)
    ├── Backend (Server Actions)
    └── API Routes (/api/*)
```

**Não precisa de domínios separados!**

---

## 🤔 Quando Usar Domínios Separados?

Você só precisaria de domínios separados se:

1. **Backend separado** (ex: Node.js/Express, Python/Django, etc.)
2. **Microserviços** (cada serviço em servidor diferente)
3. **CDN separado** para arquivos estáticos
4. **API pública** que outros sistemas consomem

**Mas seu caso não precisa!** O Next.js já faz tudo.

---

## ✅ Solução Atual (Correta)

```
app.domseven.com.br
    ├── / (páginas)
    ├── /api/* (API routes)
    └── Server Actions (integradas)
```

**Um único domínio é suficiente!**

---

## 🔧 O Problema Real

O problema não é arquitetura, é que:

1. ❌ Next.js está rodando na porta 80 (deveria ser 3000)
2. ❌ Nginx não consegue iniciar (porta 80 ocupada)
3. ❌ Certbot não consegue obter certificado (Nginx não roda)

**Solução:** Garantir que Next.js rode na porta 3000 e Nginx na porta 80.

---

## 🚀 Configuração Correta

```bash
# Next.js na porta 3000
PORT=3000 npm start

# Nginx na porta 80 (reverse proxy)
# Redireciona para localhost:3000
```

---

## 💡 Se Quiser Separar (Opcional)

Se no futuro quiser separar (não necessário agora):

```
app.domseven.com.br → Frontend (Next.js)
api.domseven.com.br → Backend (API separada)
```

Mas isso adiciona complexidade desnecessária para seu caso atual.

---

## ✅ Conclusão

**Não precisa de domínios separados!** O problema é apenas a configuração da porta. Execute o script `corrigir-definitivo-porta-80.sh` para resolver.

---

**Execute: `bash corrigir-definitivo-porta-80.sh` e depois `bash resolver-tudo-https.sh`** 🎯

