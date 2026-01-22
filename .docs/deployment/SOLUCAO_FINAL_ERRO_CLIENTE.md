# 🎯 Solução Final - Erro "Application error: a client-side exception"

## 🔍 Diagnóstico

Pelos logs que você enviou, vejo que:
- ✅ Os arquivos estáticos existem em `.next/static`
- ✅ O servidor está respondendo (curl funciona)
- ❌ **PROBLEMA:** Os arquivos estáticos provavelmente NÃO foram copiados para `.next/standalone/.next/static`

## ⚡ Solução Imediata

Execute estes comandos na VPS:

```bash
cd ~/crm-ymbale

# 1. Verificar se os arquivos estáticos estão no standalone
ls -la .next/standalone/.next/static

# Se não existir ou estiver vazio, copiar:
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

# 2. Verificar se public está copiado
ls -la .next/standalone/public

# Se não existir:
cp -r public .next/standalone/

# 3. Verificar estrutura completa
echo "=== Estrutura do standalone ==="
ls -la .next/standalone/
echo ""
echo "=== Verificando .next dentro de standalone ==="
ls -la .next/standalone/.next/
echo ""
echo "=== Verificando static dentro de standalone ==="
ls -la .next/standalone/.next/static/
echo ""

# 4. Se estiver usando servidor standalone, reiniciar
pm2 restart crm-ymbale

# 5. Testar
curl http://localhost:3000 | head -20
```

---

## 🔧 Solução Alternativa: Usar npm start

Se o problema persistir, use `npm start` que é mais confiável:

```bash
cd ~/crm-ymbale

# 1. Parar aplicação
pm2 stop crm-ymbale
pm2 delete crm-ymbale

# 2. Atualizar ecosystem.config.js para usar npm start
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    script: 'npm',
    args: 'start',
    cwd: process.cwd(),
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
EOF

# 3. Reiniciar
pm2 start ecosystem.config.js
pm2 save

# 4. Verificar
sleep 5
pm2 status
pm2 logs crm-ymbale --lines 20
```

**Por que usar `npm start`?**
- O Next.js gerencia automaticamente os caminhos dos arquivos estáticos
- Não precisa copiar manualmente os arquivos
- Mais confiável para produção

---

## 📋 Checklist de Verificação

Após aplicar a correção, verifique:

```bash
# 1. Arquivos estáticos no standalone
ls -la .next/standalone/.next/static/chunks
# Deve mostrar arquivos JS/CSS

# 2. Servidor respondendo
curl http://localhost:3000
# Deve retornar HTML completo

# 3. Status do PM2
pm2 status
# Deve mostrar "online"

# 4. Sem erros nos logs
pm2 logs crm-ymbale --err --lines 20
# Não deve ter erros vermelhos
```

---

## 🐛 Se Ainda Não Funcionar

### Verificar Console do Navegador

1. Abra o site no navegador
2. Pressione F12 (DevTools)
3. Vá na aba **Console**
4. Veja quais erros aparecem
5. Vá na aba **Network**
6. Veja quais arquivos estão falhando (status 404)

### Verificar se Arquivos Estão Sendo Servidos

```bash
# Testar se arquivos estáticos estão acessíveis
curl http://localhost:3000/_next/static/chunks/main.js
# Deve retornar código JavaScript (não 404)

# Verificar se public está acessível
curl http://localhost:3000/favicon.ico
# Deve retornar o ícone (não 404)
```

### Verificar Variáveis de Ambiente

```bash
# Verificar .env
cat .env

# Verificar se NODE_ENV está correto
echo $NODE_ENV
# Deve ser "production"
```

---

## 💡 Dica Importante

**O problema mais comum é:** Os arquivos `.next/static` não estão sendo copiados para `.next/standalone/.next/static` após o build.

**Solução:** Sempre após `npm run build`, execute:
```bash
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

---

## 🚀 Script Automático

Execute este script para verificar e corrigir tudo automaticamente:

```bash
cd ~/crm-ymbale
bash verificar-e-corrigir-estaticos.sh
```

Depois reinicie:
```bash
pm2 restart crm-ymbale
```

---

**Execute os comandos acima e me informe o resultado!** 🎯

