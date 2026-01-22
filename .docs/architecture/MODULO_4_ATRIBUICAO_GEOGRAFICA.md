# 🗺️ MÓDULO 4: ATRIBUIÇÃO GEOGRÁFICA E ZONAS

## Objetivo
Implementar sistema de atribuição automática de restaurantes a executivos baseado em localização geográfica.

## Passos de Implementação

### 1. Instalar Dependências

```bash
npm install leaflet react-leaflet @types/leaflet
# OU para Google Maps
# Configurar Google Maps API Key
```

### 2. Criar Função de Cálculo de Distância (Haversine)

**Arquivo:** `src/lib/distance-calculator.ts`

```typescript
/**
 * Calcula distância entre dois pontos usando fórmula de Haversine
 * @returns Distância em quilômetros
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Arredondar para 2 casas
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
```

### 3. Criar Função de Geocoding (Google Maps)

**Arquivo:** `src/lib/google-maps.ts`

```typescript
export async function geocodeAddress(address: {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip?: string;
}): Promise<{latitude: number; longitude: number; place_id?: string} | null> {
  // Construir endereço completo
  const fullAddress = [
    address.street,
    address.neighborhood,
    address.city,
    address.state,
    address.zip
  ].filter(Boolean).join(', ');
  
  // Chamar Google Geocoding API
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API Key não configurada');
  }
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.results.length > 0) {
    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
      place_id: data.results[0].place_id
    };
  }
  
  return null;
}
```

### 4. Criar Função de Verificação de Polígono (Ray Casting)

**Arquivo:** `src/lib/geographic-attribution.ts`

```typescript
/**
 * Verifica se um ponto está dentro de um polígono usando algoritmo Ray Casting
 */
function pontoNoPoligono(
  ponto: { lat: number; lng: number },
  poligono: Array<{ lat: number; lng: number }>
): boolean {
  let dentro = false;
  const x = ponto.lat;
  const y = ponto.lng;
  
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].lat;
    const yi = poligono[i].lng;
    const xj = poligono[j].lat;
    const yj = poligono[j].lng;
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) dentro = !dentro;
  }
  
  return dentro;
}

/**
 * Calcula o centro geométrico de um polígono
 */
function calcularCentroPoligono(
  pontos: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } {
  const soma = pontos.reduce((acc, p) => ({
    lat: acc.lat + p.lat,
    lng: acc.lng + p.lng
  }), { lat: 0, lng: 0 });
  
  return {
    lat: soma.lat / pontos.length,
    lng: soma.lng / pontos.length
  };
}
```

### 5. Criar Função Principal de Atribuição

**Arquivo:** `src/lib/geographic-attribution.ts`

```typescript
export async function atribuirExecutivoAutomatico(restaurante: {
  id?: string;
  name?: string;
  address?: any;
  cep?: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{
  sucesso: boolean;
  executivo_id?: string;
  executivo_nome?: string;
  distancia_km?: number;
  metodo?: string;
  erro?: string;
  coordenadas?: { lat: number; lng: number };
}> {
  try {
    // 1. Obter coordenadas do restaurante
    let coordRestaurante: { lat: number; lng: number } | null = null;
    
    if (restaurante.latitude && restaurante.longitude) {
      // Usar coordenadas em cache
      coordRestaurante = {
        lat: restaurante.latitude,
        lng: restaurante.longitude
      };
    } else {
      // Buscar coordenadas via Google Maps API
      if (!restaurante.address) {
        return { sucesso: false, erro: 'Endereço não fornecido' };
      }
      
      const googleCoords = await geocodeAddress(restaurante.address);
      
      if (!googleCoords) {
        return { sucesso: false, erro: 'Não foi possível obter coordenadas' };
      }
      
      coordRestaurante = {
        lat: googleCoords.latitude,
        lng: googleCoords.longitude
      };
      
      // Salvar coordenadas no banco para cache (se tiver ID)
      if (restaurante.id) {
        await prisma.restaurant.update({
          where: { id: restaurante.id },
          data: {
            latitude: coordRestaurante.lat,
            longitude: coordRestaurante.lng,
            geocodingData: googleCoords as any,
            geocodingAtualizadoEm: new Date()
          }
        });
      }
    }
    
    // 2. Buscar executivos com território ativo
    const executivos = await prisma.seller.findMany({
      where: {
        territorioAtivo: true,
        OR: [
          { territorioTipo: 'raio' },
          { territorioTipo: 'poligono' },
          { areasCobertura: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        territorioTipo: true,
        baseCidade: true,
        baseLatitude: true,
        baseLongitude: true,
        raioKm: true,
        poligonoPontos: true,
        areasCobertura: true
      }
    });
    
    if (executivos.length === 0) {
      return { sucesso: false, erro: 'Nenhum executivo com território configurado' };
    }
    
    // 3. Verificar cada executivo e calcular distâncias
    const candidatos: Array<{
      executivo_id: string;
      executivo_nome: string;
      distancia_km: number;
      metodo: string;
    }> = [];
    
    for (const exec of executivos) {
      // Verificar múltiplas áreas primeiro
      if (exec.areasCobertura && Array.isArray(exec.areasCobertura) && exec.areasCobertura.length > 0) {
        for (const area of exec.areasCobertura) {
          if (!area.latitude || !area.longitude || !area.raioKm) continue;
          
          const distancia = calculateDistance(
            coordRestaurante.lat,
            coordRestaurante.lng,
            area.latitude,
            area.longitude
          );
          
          if (distancia <= area.raioKm) {
            candidatos.push({
              executivo_id: exec.id,
              executivo_nome: exec.name,
              distancia_km: distancia,
              metodo: 'raio_multiplas_areas'
            });
            break; // Encontrou uma área, não precisa verificar as outras
          }
        }
        continue;
      }
      
      // Verificar raio único
      if (exec.territorioTipo === 'raio') {
        if (!exec.baseLatitude || !exec.baseLongitude || !exec.raioKm) continue;
        
        const distancia = calculateDistance(
          coordRestaurante.lat,
          coordRestaurante.lng,
          Number(exec.baseLatitude),
          Number(exec.baseLongitude)
        );
        
        if (distancia <= exec.raioKm) {
          candidatos.push({
            executivo_id: exec.id,
            executivo_nome: exec.name,
            distancia_km: distancia,
            metodo: 'raio'
          });
        }
      }
      
      // Verificar polígono
      else if (exec.territorioTipo === 'poligono') {
        if (!exec.poligonoPontos) continue;
        
        try {
          const poligono = (exec.poligonoPontos as any).pontos || exec.poligonoPontos;
          const dentroDoPoligono = pontoNoPoligono(coordRestaurante, poligono);
          
          if (dentroDoPoligono) {
            const centroPoligono = calcularCentroPoligono(poligono);
            const distancia = calculateDistance(
              coordRestaurante.lat,
              coordRestaurante.lng,
              centroPoligono.lat,
              centroPoligono.lng
            );
            
            candidatos.push({
              executivo_id: exec.id,
              executivo_nome: exec.name,
              distancia_km: distancia,
              metodo: 'poligono'
            });
          }
        } catch (error) {
          console.error(`Erro ao processar polígono do executivo ${exec.name}:`, error);
        }
      }
    }
    
    // 4. Se nenhum candidato, retornar erro
    if (candidatos.length === 0) {
      return {
        sucesso: false,
        erro: 'Restaurante fora de todas as áreas de cobertura geográfica',
        coordenadas: coordRestaurante
      };
    }
    
    // 5. Se múltiplos candidatos, escolher o mais próximo
    candidatos.sort((a, b) => a.distancia_km - b.distancia_km);
    const escolhido = candidatos[0];
    
    return {
      sucesso: true,
      executivo_id: escolhido.executivo_id,
      executivo_nome: escolhido.executivo_nome,
      distancia_km: escolhido.distancia_km,
      metodo: escolhido.metodo,
      coordenadas: coordRestaurante
    };
    
  } catch (error: any) {
    console.error('Erro na atribuição automática:', error);
    return { sucesso: false, erro: error.message };
  }
}
```

### 6. Sistema de Zonas (Legado - Opcional)

**Arquivo:** `src/lib/geographic-attribution.ts`

```typescript
/**
 * Busca zona pelo CEP (sistema legado)
 */
export async function findZonaByCep(cep: string): Promise<{id: string; zonaNome: string} | null> {
  // Normalizar CEP (remover hífen)
  const cepNormalizado = cep.replace(/[^\d]/g, '');
  
  // Buscar zona onde o CEP está no range
  const zona = await prisma.$queryRaw<Array<{id: string; zona_nome: string}>>`
    SELECT id, zona_nome
    FROM zonas_cep
    WHERE ativo = true
      AND REPLACE(cep_inicial, '-', '') <= ${cepNormalizado}
      AND REPLACE(cep_final, '-', '') >= ${cepNormalizado}
    LIMIT 1
  `;
  
  return zona.length > 0 ? {id: zona[0].id, zonaNome: zona[0].zona_nome} : null;
}

/**
 * Busca executivo responsável por uma zona
 */
export async function findSellerByZona(zonaId: string): Promise<{id: string; name: string} | null> {
  const seller = await prisma.$queryRaw<Array<{id: string; name: string}>>`
    SELECT s.id, s.name
    FROM sellers s
    INNER JOIN seller_zonas sz ON s.id = sz.seller_id
    WHERE sz.zona_id = ${zonaId}::uuid
      AND s.active = true
    LIMIT 1
  `;
  
  return seller.length > 0 ? {id: seller[0].id, name: seller[0].name} : null;
}
```

### 7. Criar Server Action de Sincronização

**Arquivo:** `src/app/actions.ts`

```typescript
export async function syncRestaurantsWithSellers() {
  'use server';
  
  // 1. Buscar restaurantes sem executivo OU com zonaId
  const restaurants = await prisma.restaurant.findMany({
    where: {
      OR: [
        { sellerId: null },
        { zonaId: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      zonaId: true
    }
  });
  
  let atribuidos = 0;
  let naoAtribuidos = 0;
  
  // 2. Para cada restaurante
  for (const restaurant of restaurants) {
    let sellerId: string | null = null;
    
    // 2.1. Se tem zonaId, buscar executivo da zona
    if (restaurant.zonaId) {
      const seller = await findSellerByZona(restaurant.zonaId);
      if (seller) sellerId = seller.id;
    }
    
    // 2.2. Se não encontrou por zona, tentar atribuição geográfica
    if (!sellerId && restaurant.address) {
      const atribuicao = await atribuirExecutivoAutomatico({
        id: restaurant.id,
        address: restaurant.address,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude
      });
      
      if (atribuicao.sucesso) {
        sellerId = atribuicao.executivo_id;
      }
    }
    
    // 2.3. Atualizar restaurante
    if (sellerId) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          sellerId: sellerId,
          assignedAt: new Date()
        }
      });
      atribuidos++;
    } else {
      naoAtribuidos++;
    }
  }
  
  revalidatePath('/carteira');
  revalidatePath('/clients');
  
  return {
    success: true,
    atribuidos,
    naoAtribuidos,
    total: restaurants.length
  };
}
```

### 8. Interface de Configuração de Território

**Arquivo:** `src/app/sellers/[id]/page.tsx` ou componente separado

**Funcionalidades:**
- Selecionar tipo de território (raio, polígono, múltiplas áreas)
- Para raio: selecionar cidade base e definir raio em km
- Para polígono: desenhar polígono no mapa
- Para múltiplas áreas: adicionar várias áreas de cobertura
- Visualizar área no mapa
- Ativar/desativar território

## Validações

1. **Coordenadas:** Validar range (-90 a 90 para lat, -180 a 180 para lng)
2. **Raio:** Deve ser positivo
3. **Polígono:** Mínimo 3 pontos, fechar o polígono
4. **Múltiplas áreas:** Não permitir sobreposição excessiva

## Rate Limiting

- Google Geocoding API: ~50 requests/segundo
- Implementar delay entre requisições se necessário
- Cachear coordenadas sempre que possível

## Testes

1. Atribuir restaurante dentro de raio
2. Atribuir restaurante dentro de polígono
3. Atribuir restaurante com múltiplas áreas
4. Restaurante fora de todas as áreas
5. Múltiplos candidatos (escolher mais próximo)
6. Cache de coordenadas

## Próximo Módulo

Após concluir este módulo, seguir para: **MÓDULO 5: PIPELINE E STATUS**
