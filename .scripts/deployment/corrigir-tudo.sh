#!/bin/bash
# Script Completo para Corrigir Porta 80 e Erro de Cliente
# Execute: bash corrigir-tudo.sh

set -e

echo "=========================================="
echo "  CORREÇÃO COMPLETA - PORTA 80 E ERRO CLIENTE"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd ~/crm-ymbale

# PARTE 1: Corrigir Erro de Cliente
echo "=========================================="
echo "  PARTE 1: Corrigindo Erro de Cliente"
echo "=========================================="
echo ""

echo "1. Parando aplicação..."
pm2 stop crm-ymbale 2>/dev/null || pm2 delete crm-ymbale 2>/dev/null || true
echo -e "${GREEN}✅ Aplicação parada${NC}"
echo ""

echo "2. Limpando build anterior..."
rm -rf .next
echo -e "${GREEN}✅ Build limpo${NC}"
echo ""

echo "3. Fazendo rebuild..."
if npm run build; then
    echo -e "${GREEN}✅ Build concluído${NC}"
else
    echo -e "${RED}❌ Erro no build${NC}"
    exit 1
fi
echo ""

echo "4. Configurando ecosystem.config.js para usar npm start..."
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
echo -e "${GREEN}✅ ecosystem.config.js atualizado${NC}"
echo ""

echo "5. Criando diretório de logs..."
mkdir -p logs
echo -e "${GREEN}✅ Diretório de logs criado${NC}"
echo ""

echo "6. Reiniciando aplicação..."
pm2 delete crm-ymbale 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✅ Aplicação reiniciada${NC}"
echo ""

echo "7. Aguardando inicialização..."
sleep 5
echo ""

echo "8. Testando porta 3000..."
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Servidor respondendo na porta 3000${NC}"
else
    echo -e "${YELLOW}⚠️  Servidor pode não estar respondendo ainda${NC}"
fi
echo ""

# PARTE 2: Configurar Nginx
echo "=========================================="
echo "  PARTE 2: Configurando Nginx (Porta 80)"
echo "=========================================="
echo ""

echo "1. Verificando se Nginx está instalado..."
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}⚠️  Nginx não encontrado. Instalando...${NC}"
    apt update
    apt install -y nginx
    echo -e "${GREEN}✅ Nginx instalado${NC}"
else
    echo -e "${GREEN}✅ Nginx já instalado${NC}"
fi
echo ""

echo "2. Criando configuração do Nginx..."
cat > /etc/nginx/sites-available/crm << 'EOF'
server {
    listen 80;
    server_name _;
    
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}
EOF
echo -e "${GREEN}✅ Configuração criada${NC}"
echo ""

echo "3. Habilitando site..."
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
echo -e "${GREEN}✅ Site habilitado${NC}"
echo ""

echo "4. Testando configuração do Nginx..."
if nginx -t; then
    echo -e "${GREEN}✅ Configuração válida${NC}"
else
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    exit 1
fi
echo ""

echo "5. Reiniciando Nginx..."
systemctl restart nginx
systemctl enable nginx 2>/dev/null || true
echo -e "${GREEN}✅ Nginx reiniciado${NC}"
echo ""

echo "6. Verificando status do Nginx..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando${NC}"
else
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    systemctl status nginx
fi
echo ""

# PARTE 3: Configurar Firewall
echo "=========================================="
echo "  PARTE 3: Configurando Firewall"
echo "=========================================="
echo ""

echo "1. Verificando firewall..."
if command -v ufw &> /dev/null; then
    echo "   Abrindo portas necessárias..."
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    ufw allow 3000/tcp 2>/dev/null || true
    echo -e "${GREEN}✅ Portas configuradas${NC}"
else
    echo -e "${YELLOW}⚠️  UFW não encontrado. Configure o firewall manualmente${NC}"
fi
echo ""

# PARTE 4: Verificação Final
echo "=========================================="
echo "  PARTE 4: Verificação Final"
echo "=========================================="
echo ""

echo "1. Status do PM2:"
pm2 status
echo ""

echo "2. Status do Nginx:"
systemctl status nginx --no-pager | head -5
echo ""

echo "3. Testando porta 3000 (direto):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Porta 3000 respondendo${NC}"
else
    echo -e "${YELLOW}⚠️  Porta 3000 pode não estar respondendo${NC}"
fi
echo ""

echo "4. Testando porta 80 (via Nginx):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Porta 80 respondendo (via Nginx)${NC}"
else
    echo -e "${YELLOW}⚠️  Porta 80 pode não estar respondendo${NC}"
fi
echo ""

echo "5. Verificando processos:"
echo "   PM2:"
pm2 list | grep crm-ymbale || echo "   Nenhum processo encontrado"
echo "   Nginx:"
ps aux | grep nginx | grep -v grep | head -2 || echo "   Nginx não está rodando"
echo ""

# Resumo
echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Correção completa aplicada!${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Acesse http://SEU_IP (sem porta) - deve funcionar via Nginx"
echo "  2. Acesse http://SEU_IP:3000 (com porta) - deve funcionar diretamente"
echo "  3. Se ainda houver erro, verifique:"
echo "     - pm2 logs crm-ymbale --err --lines 50"
echo "     - tail -50 /var/log/nginx/error.log"
echo "     - Console do navegador (F12)"
echo ""
echo "Comandos úteis:"
echo "  - Ver logs PM2: pm2 logs crm-ymbale"
echo "  - Ver logs Nginx: tail -f /var/log/nginx/error.log"
echo "  - Reiniciar PM2: pm2 restart crm-ymbale"
echo "  - Reiniciar Nginx: systemctl restart nginx"
echo ""
echo "=========================================="

