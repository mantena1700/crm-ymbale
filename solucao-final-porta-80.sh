#!/bin/bash
# Solução Final para Porta 80
# Execute: bash solucao-final-porta-80.sh

echo "=========================================="
echo "  SOLUÇÃO FINAL - PORTA 80"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Verificando conexões TIME_WAIT..."
echo "------------------------------------------"
TIME_WAIT_COUNT=$(netstat -an | grep :80 | grep TIME_WAIT | wc -l)
echo "   Conexões TIME_WAIT: $TIME_WAIT_COUNT"

if [ "$TIME_WAIT_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Há conexões em TIME_WAIT${NC}"
    echo "   Isso pode estar bloqueando a porta"
    echo "   Aguardando 10 segundos para expirarem..."
    sleep 10
else
    echo -e "${GREEN}✅ Nenhuma conexão TIME_WAIT${NC}"
fi
echo ""

echo "2. Verificando configurações de rede..."
echo "------------------------------------------"
# Verificar se SO_REUSEADDR está habilitado
sysctl net.ipv4.tcp_tw_reuse 2>/dev/null || echo "   tcp_tw_reuse não configurado"
sysctl net.ipv4.ip_local_port_range 2>/dev/null || echo "   ip_local_port_range não configurado"
echo ""

echo "3. Habilitando SO_REUSEADDR temporariamente..."
echo "------------------------------------------"
sysctl -w net.ipv4.tcp_tw_reuse=1 2>/dev/null || true
echo ""

echo "4. Verificando TODOS os processos que podem usar porta 80..."
echo "------------------------------------------"
# Verificar processos de rede
ps aux | grep -E "nginx|apache|httpd|node|next" | grep -v grep
echo ""

# Verificar sockets
if command -v ss &> /dev/null; then
    echo "   Sockets na porta 80:"
    ss -tulpn | grep :80
fi
echo ""

echo "5. Parando TUDO relacionado a web servers..."
echo "------------------------------------------"
pkill -9 nginx 2>/dev/null || true
pkill -9 apache 2>/dev/null || true
pkill -9 httpd 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
systemctl stop httpd 2>/dev/null || true
pm2 stop all 2>/dev/null || true
sleep 5
echo ""

echo "6. Verificando se há processos escondidos..."
echo "------------------------------------------"
# Verificar processos por nome de arquivo
lsof 2>/dev/null | grep -E "nginx|:80" | head -10 || echo "   Nenhum processo encontrado"
echo ""

echo "7. Verificando se porta 80 está realmente livre..."
echo "------------------------------------------"
# Tentar fazer bind manualmente
if command -v python3 &> /dev/null; then
    python3 << 'PYTHON'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(('0.0.0.0', 80))
    print("✅ Porta 80 está livre (teste Python)")
    s.close()
except OSError as e:
    print(f"❌ Porta 80 não está livre: {e}")
PYTHON
else
    echo "   Python não disponível para teste"
fi
echo ""

echo "8. Verificando configuração do Nginx..."
echo "------------------------------------------"
if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}✅ Configuração OK${NC}"
    
    # Verificar se há múltiplos listen 80
    LISTEN_COUNT=$(grep -r "listen 80" /etc/nginx/ 2>/dev/null | wc -l)
    echo "   Configurações 'listen 80' encontradas: $LISTEN_COUNT"
    
    if [ "$LISTEN_COUNT" -gt 1 ]; then
        echo -e "${YELLOW}⚠️  Múltiplas configurações listen 80 podem causar conflito${NC}"
    fi
else
    echo -e "${RED}❌ Erro na configuração${NC}"
    nginx -t
    exit 1
fi
echo ""

echo "9. Tentando iniciar Nginx com método alternativo..."
echo "------------------------------------------"
# Tentar iniciar como root diretamente
/usr/sbin/nginx -g "daemon on;" 2>&1 &
NGINX_DIRECT_PID=$!
sleep 3

if ps -p $NGINX_DIRECT_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx iniciou diretamente!${NC}"
    echo "   Parando processo direto..."
    kill $NGINX_DIRECT_PID 2>/dev/null || true
    sleep 1
    echo ""
    echo "10. Iniciando via systemd..."
    systemctl start nginx
    sleep 2
else
    echo -e "${RED}❌ Nginx não iniciou nem diretamente${NC}"
    echo ""
    echo "11. Verificando se há problema com capabilities..."
    getcap /usr/sbin/nginx 2>/dev/null || echo "   getcap não disponível"
    echo ""
    echo "12. Tentando com setcap (se necessário)..."
    setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx 2>/dev/null || echo "   setcap não funcionou ou não necessário"
    echo ""
    echo "13. Tentando iniciar novamente..."
    systemctl start nginx
    sleep 2
fi
echo ""

echo "14. Verificação final..."
echo "------------------------------------------"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅✅✅ NGINX ESTÁ RODANDO! ✅✅✅${NC}"
    echo ""
    systemctl status nginx --no-pager | head -10
    echo ""
    lsof -i :80 | grep nginx || echo "   Verificando porta 80..."
    echo ""
    echo "   Teste:"
    curl -I http://localhost 2>/dev/null | head -3 || echo "   Teste falhou"
else
    echo -e "${RED}❌ Nginx ainda não está rodando${NC}"
    echo ""
    echo "   Última tentativa: reiniciar servidor pode resolver"
    echo "   OU verificar se há firewall bloqueando"
    echo ""
    echo "   Comandos para diagnóstico:"
    echo "   - journalctl -xeu nginx.service -n 50"
    echo "   - dmesg | tail -20"
    echo "   - iptables -L -n | grep 80"
fi
echo ""

echo "=========================================="

