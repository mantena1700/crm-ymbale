# 🔧 Comandos Manuais para VPS

Execute estes comandos **UM POR VEZ** na VPS:

## 1. Resolver Git (Execute primeiro)

```bash
cd ~/crm-ymbale
git fetch origin main
git reset --hard origin/main
git clean -fd
```

## 2. Atualizar Dependências

```bash
npm install
```

## 3. Atualizar Prisma

```bash
npx prisma generate
npx prisma db push
```

## 4. Build

```bash
npm run build
```

## 5. Copiar Arquivos Estáticos (se necessário)

```bash
cp -r public .next/standalone/ 2>/dev/null || true
mkdir -p .next/standalone/.next 2>/dev/null || true
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
```

## 6. Parar Aplicação

```bash
pm2 stop crm-ymbale
```

## 7. Iniciar Aplicação

```bash
pm2 start ecosystem.config.js
pm2 save
```

## 8. Verificar Status

```bash
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## ⚡ Tudo de Uma Vez (Copie e Cole)

```bash
cd ~/crm-ymbale && \
git fetch origin main && \
git reset --hard origin/main && \
git clean -fd && \
npm install && \
npx prisma generate && \
npx prisma db push && \
npm run build && \
cp -r public .next/standalone/ 2>/dev/null || true && \
mkdir -p .next/standalone/.next 2>/dev/null || true && \
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true && \
pm2 stop crm-ymbale && \
pm2 start ecosystem.config.js && \
pm2 save && \
pm2 status
```

---

## 🐛 Se Der Erro

### Erro no Git:
```bash
cd ~/crm-ymbale
rm -rf .git
git clone https://github.com/mantena1700/crm-ymbale.git .
```

### Erro no Build:
```bash
rm -rf .next
npm run build
```

### Erro no PM2:
```bash
pm2 delete crm-ymbale
pm2 start ecosystem.config.js
pm2 save
```

