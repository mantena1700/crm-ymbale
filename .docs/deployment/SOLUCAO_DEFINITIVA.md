# 🎯 Solução Definitiva - Erro "Application error"

## 🔍 Problema Identificado

Mesmo com os arquivos estáticos copiados corretamente, o servidor standalone pode ter problemas servindo os arquivos. A solução é usar `npm start` que é mais confiável.

## ⚡ Solução - Execute na VPS AGORA

```bash
cd ~/crm-ymbale

# 1. Parar aplicação
pm2 stop crm-ymbale
pm2 delete crm-ymbale

# 2. Mudar para npm start (mais confiável)
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

# 4. Aguardar inicialização
sleep 5

# 5. Verificar
pm2 status
pm2 logs crm-ymbale --lines 30
```

## ✅ Por Que npm start Funciona Melhor?

1. **Gerenciamento automático de caminhos:** O Next.js gerencia automaticamente onde encontrar os arquivos estáticos
2. **Não precisa copiar arquivos:** O `npm start` usa os arquivos diretamente de `.next/static` e `public`
3. **Mais confiável:** É o método recomendado pela documentação do Next.js para produção
4. **Menos problemas:** Evita problemas de caminhos relativos do servidor standalone

## 🔍 Verificação

Após executar, verifique:

```bash
# 1. Status
pm2 status
# Deve mostrar "online"

# 2. Testar servidor
curl http://localhost:3000
# Deve retornar HTML completo

# 3. Ver logs
pm2 logs crm-ymbale --err --lines 20
# Não deve ter erros

# 4. Testar no navegador
# Acesse http://SEU_IP:3000
# Deve carregar sem erro "Application error"
```

## 🐛 Se Ainda Não Funcionar

### Verificar Console do Navegador

1. Abra o site no navegador
2. Pressione **F12** (DevTools)
3. Vá na aba **Console**
4. Veja quais erros aparecem
5. Vá na aba **Network**
6. Veja quais arquivos estão falhando (status 404)

### Verificar se Arquivos Estão Acessíveis

```bash
# Testar arquivos estáticos
curl http://localhost:3000/_next/static/chunks/main.js
# Deve retornar código JavaScript (não 404)

# Verificar se public está acessível
curl http://localhost:3000/favicon.ico
# Deve retornar o ícone (não 404)
```

### Verificar Variáveis de Ambiente

```bash
# Verificar .env
cat .env | grep -v "PASSWORD\|SECRET\|KEY" 

# Verificar NODE_ENV
pm2 show crm-ymbale | grep NODE_ENV
# Deve ser "production"
```

## 📝 Nota Importante

Com `npm start`, você **NÃO precisa** copiar arquivos para standalone. O Next.js gerencia tudo automaticamente. Os arquivos em `.next/static` e `public` são usados diretamente.

---

**Execute os comandos acima e o problema deve ser resolvido!** 🎯

