#!/bin/bash
# ============================================
# SCRIPT DE INSTALAÇÃO DO CRM YMBALE
# Para VPS Ubuntu 22.04/24.04
# ============================================

set -e

echo "🚀 INSTALAÇÃO DO CRM YMBALE"
echo "=================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Execute como root: sudo ./install.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Atualizando sistema...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}📦 Instalando dependências...${NC}"
apt install -y ca-certificates curl gnupg lsb-release git

echo -e "${YELLOW}🐳 Instalando Docker...${NC}"
# Remover versões antigas
apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Adicionar repositório Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar Docker
docker --version
docker compose version

echo -e "${GREEN}✅ Docker instalado com sucesso!${NC}"

echo -e "${YELLOW}🔥 Configurando Firewall...${NC}"
# Instalar ufw se não existir
apt install -y ufw

ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo -e "${GREEN}✅ Firewall configurado!${NC}"

echo -e "${YELLOW}📁 Configurando projeto...${NC}"
cd /root/crm-ymbale

# Criar arquivo .env
cat > .env << 'EOF'
DATABASE_URL="postgresql://crm_user:crm_senha_segura_2024@postgres:5432/crm_ymbale?schema=public"
NODE_ENV=production
EOF

# Criar tipos do Google Maps
mkdir -p src/types
cat > src/types/google-maps.d.ts << 'EOF'
/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace google {
  namespace maps {
    class Map { constructor(element: HTMLElement, options?: any); setMapTypeId(mapTypeId: string): void; getCenter(): any; fitBounds(bounds: any): void; }
    class Marker { constructor(options?: any); setMap(map: Map | null): void; getPosition(): any; addListener(event: string, handler: () => void): void; }
    class DirectionsService { route(request: any): Promise<any>; }
    class DirectionsRenderer { constructor(options?: any); setDirections(directions: any): void; setMap(map: Map | null): void; }
    class Geocoder { geocode(request: any): Promise<any>; }
    class InfoWindow { constructor(options?: any); open(map: Map, marker: Marker): void; }
    class LatLng { constructor(lat: number, lng: number); lat(): number; lng(): number; }
    class LatLngBounds { constructor(); extend(point: any): void; }
    class TrafficLayer { constructor(); setMap(map: Map | null): void; }
    const SymbolPath: { CIRCLE: any; FORWARD_CLOSED_ARROW: any; FORWARD_OPEN_ARROW: any; BACKWARD_CLOSED_ARROW: any; BACKWARD_OPEN_ARROW: any; };
    const Animation: { BOUNCE: any; DROP: any; };
    const TravelMode: { DRIVING: any; WALKING: any; BICYCLING: any; TRANSIT: any; [key: string]: any; };
    namespace geometry { namespace spherical { function computeDistanceBetween(from: any, to: any): number; } }
    interface DirectionsWaypoint { location: any; stopover?: boolean; }
  }
}
EOF

echo -e "${GREEN}✅ Arquivos configurados!${NC}"

echo -e "${YELLOW}🐳 Construindo containers (pode demorar 5-10 min)...${NC}"
docker compose up -d --build

echo -e "${YELLOW}⏳ Aguardando banco de dados ficar pronto...${NC}"
sleep 15

echo -e "${YELLOW}📊 Criando tabelas do banco...${NC}"
docker compose exec -T crm prisma db push --skip-generate

echo -e "${YELLOW}👤 Criando usuário administrador...${NC}"
docker compose exec -T crm tsx scripts/create-admin.ts

echo ""
echo -e "${GREEN}=================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "==================================${NC}"
echo ""
echo -e "🌐 Acesse: ${YELLOW}http://$(curl -s ifconfig.me)${NC}"
echo ""
echo -e "📋 Credenciais:"
echo -e "   Usuário: ${YELLOW}admin${NC}"
echo -e "   Senha:   ${YELLOW}admin${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANTE: Troque a senha no primeiro acesso!${NC}"
echo ""
