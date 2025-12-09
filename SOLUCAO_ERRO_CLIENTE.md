# 🚨 Solução para Erro "Application error: a client-side exception"

## ⚡ Solução Rápida - Execute na VPS

O erro indica que os arquivos estáticos do cliente não estão sendo servidos. Execute:

```bash
cd ~/crm-ymbale

# 1. Parar aplicação
pm2 stop crm-ymbale
pm2 delete crm-ymbale

# 2. Limpar build anterior completamente
rm -rf .next

# 3. Rebuild completo
npm run build

# 4. Verificar se .next/static foi criado
ls -la .next/static
# Se não existir, há um problema no build

# 5. Copiar TODOS os arquivos necessários
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

# 6. Verificar estrutura completa
echo "=== Verificando estrutura ==="
ls -la .next/standalone/server.js
ls -la .next/standalone/public
ls -la .next/standalone/.next/static
echo ""

# 7. Atualizar ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-ymbale',
    script: '.next/standalone/server.js',
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

# 8. Criar diretório de logs
mkdir -p logs

# 9. Reiniciar
pm2 start ecosystem.config.js
pm2 save

# 10. Aguardar e verificar
sleep 5
pm2 status
pm2 logs crm-ymbale --lines 20
```

---

## 🔍 Diagnóstico Detalhado

Se ainda não funcionar, execute estes comandos de diagnóstico:

```bash
# 1. Verificar se .next/static existe ANTES de copiar
ls -la .next/static
# Deve mostrar diretórios com arquivos

# 2. Verificar conteúdo de .next/static
ls -la .next/static/*/
# Deve mostrar subdiretórios com arquivos JS/CSS

# 3. Verificar se foi copiado corretamente
ls -la .next/standalone/.next/static
# Deve ter a mesma estrutura

# 4. Verificar permissões
ls -la .next/standalone/server.js
chmod +x .next/standalone/server.js

# 5. Testar servidor manualmente
cd .next/standalone
NODE_ENV=production PORT=3000 node server.js
# Pressione Ctrl+C após testar
```

---

## 🐛 Problema Específico: Arquivos Estáticos Não Encontrados

Se o erro persistir, pode ser que o Next.js não esteja servindo os arquivos estáticos corretamente. Tente:

### Opção 1: Usar npm start (temporário)

Se o standalone não funcionar, use temporariamente:

```bash
# Atualizar ecosystem.config.js para usar npm start
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

pm2 delete crm-ymbale
pm2 start ecosystem.config.js
pm2 save
```

### Opção 2: Verificar Variáveis de Ambiente

```bash
# Verificar .env
cat .env

# Verificar se DATABASE_URL está configurada
grep DATABASE_URL .env

# Verificar outras variáveis importantes
grep -E "NEXTAUTH|NODE_ENV" .env
```

---

## 📋 Checklist de Verificação

Após aplicar a correção, verifique:

- [ ] `ls -la .next/static` mostra diretórios com arquivos
- [ ] `ls -la .next/standalone/.next/static` mostra os mesmos arquivos
- [ ] `ls -la .next/standalone/public` mostra arquivos públicos
- [ ] `pm2 status` mostra `online`
- [ ] `curl http://localhost:3000` retorna HTML completo
- [ ] No navegador, console (F12) não mostra erros de arquivos não encontrados

---

## 🆘 Se Ainda Não Funcionar

1. **Ver logs completos:**
   ```bash
   pm2 logs crm-ymbale --err --lines 100
   ```

2. **Verificar console do navegador:**
   - Pressione F12
   - Vá na aba Console
   - Veja quais erros aparecem
   - Vá na aba Network
   - Veja quais arquivos estão falhando (404)

3. **Testar build localmente:**
   ```bash
   npm run build
   npm start
   # Testar em outro terminal: curl http://localhost:3000
   ```

4. **Verificar se há problemas com o build:**
   ```bash
   npm run build 2>&1 | tee build.log
   # Verificar se há erros no build.log
   ```

---

**Execute os comandos acima e me envie o resultado!** 🎯

