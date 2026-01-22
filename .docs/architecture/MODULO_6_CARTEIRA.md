# 👥 MÓDULO 6: CARTEIRA E EXECUTIVOS

## Objetivo
Implementar sistema completo de gestão de carteira de clientes por executivo, com planejamento semanal e visualização geográfica.

## Passos de Implementação

### 1. Estrutura da Página de Carteira

**Arquivo:** `src/app/carteira/page.tsx`

**Abas Principais:**
1. **Carteira Padrão** - Visão consolidada
2. **Carteira Individual** - Por executivo
3. **Semana** - Planejamento semanal
4. **Agenda** - Calendário de follow-ups
5. **Mapa** - Visualização geográfica
6. **Exportar Checkmob** - Exportação para sistema externo
7. **Exportar Agendamento** - Exportação para template Excel
8. **Clientes Fixos** - Gestão de recorrência

### 2. Carteira Padrão

**Funcionalidades:**
- Lista todos os executivos
- Para cada executivo:
  - Avatar e informações básicas
  - Estatísticas:
    - Total de clientes
    - Por status (Qualificado, Contatado, etc.)
    - Por potencial (ALTÍSSIMO, ALTO, etc.)
  - Cards dos restaurantes atribuídos
- Filtros globais:
  - Por status
  - Por potencial
  - Por período (últimos 7/30/90 dias)
  - Por busca textual

**Implementação:**
```typescript
export default function CarteiraClient({ initialData }) {
  const { sellers, restaurants } = initialData;
  const [selectedSellerId, setSelectedSellerId] = useState('all');
  const [filters, setFilters] = useState({
    status: 'all',
    potential: [],
    period: 'all',
    search: ''
  });
  
  // Filtrar restaurantes
  const filteredRestaurants = useMemo(() => {
    let filtered = restaurants;
    
    if (selectedSellerId !== 'all') {
      filtered = filtered.filter(r => r.seller?.id === selectedSellerId);
    }
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(r => r.status === filters.status);
    }
    
    if (filters.potential.length > 0) {
      filtered = filtered.filter(r => 
        filters.potential.includes(r.salesPotential)
      );
    }
    
    if (filters.search) {
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    
    return filtered;
  }, [restaurants, selectedSellerId, filters]);
  
  // Agrupar por executivo
  const restaurantsBySeller = useMemo(() => {
    const grouped: Record<string, Restaurant[]> = {};
    filteredRestaurants.forEach(r => {
      const sellerId = r.seller?.id || 'sem-executivo';
      if (!grouped[sellerId]) grouped[sellerId] = [];
      grouped[sellerId].push(r);
    });
    return grouped;
  }, [filteredRestaurants]);
  
  return (
    <div>
      {/* Filtros */}
      <div className={styles.filters}>
        {/* Componente de filtros */}
      </div>
      
      {/* Lista de executivos */}
      {sellers.map(seller => {
        const sellerRestaurants = restaurantsBySeller[seller.id] || [];
        const stats = {
          total: sellerRestaurants.length,
          qualificado: sellerRestaurants.filter(r => r.status === 'Qualificado').length,
          contatado: sellerRestaurants.filter(r => r.status === 'Contatado').length,
          negociacao: sellerRestaurants.filter(r => r.status === 'Negociação').length,
          fechado: sellerRestaurants.filter(r => r.status === 'Fechado').length
        };
        
        return (
          <div key={seller.id} className={styles.executivoSection}>
            <div className={styles.executivoHeader}>
              <div className={styles.executivoInfo}>
                <Avatar src={seller.photoUrl} name={seller.name} />
                <div>
                  <h3>{seller.name}</h3>
                  <p>{seller.email}</p>
                </div>
              </div>
              <div className={styles.stats}>
                <Stat label="Total" value={stats.total} />
                <Stat label="Qualificado" value={stats.qualificado} />
                <Stat label="Contatado" value={stats.contatado} />
                <Stat label="Negociação" value={stats.negociacao} />
                <Stat label="Fechado" value={stats.fechado} />
              </div>
            </div>
            
            <div className={styles.restaurantsGrid}>
              {sellerRestaurants.map(restaurant => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 3. Planejamento Semanal

**Funcionalidades:**
- Calendário semanal (segunda a sexta)
- Slots de horário (manhã, tarde, noite)
- Arrastar restaurantes para slots
- Preenchimento automático inteligente
- Exportação para Excel

**Estrutura de Dados:**
```typescript
interface WeeklySchedule {
  [date: string]: {
    [timeSlot: string]: {
      restaurantId: string;
      restaurantName: string;
      notes?: string;
    }[];
  };
}
```

**Componente:**
```typescript
export default function WeeklyCalendar({ sellerId, weekStart }) {
  const [schedule, setSchedule] = useState<WeeklySchedule>({});
  const [draggedRestaurant, setDraggedRestaurant] = useState<Restaurant | null>(null);
  
  const timeSlots = ['manha', 'tarde', 'noite'];
  const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  
  const handleDrop = (date: string, timeSlot: string) => {
    if (!draggedRestaurant) return;
    
    setSchedule(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [timeSlot]: [
          ...(prev[date]?.[timeSlot] || []),
          {
            restaurantId: draggedRestaurant.id,
            restaurantName: draggedRestaurant.name
          }
        ]
      }
    }));
  };
  
  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button onClick={previousWeek}>←</button>
        <h2>Semana de {formatWeek(weekStart)}</h2>
        <button onClick={nextWeek}>→</button>
      </div>
      
      <table className={styles.schedule}>
        <thead>
          <tr>
            <th></th>
            {weekDays.map(day => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(slot => (
            <tr key={slot}>
              <td className={styles.timeSlot}>{slot}</td>
              {weekDays.map((day, index) => {
                const date = getDateForDay(weekStart, index);
                return (
                  <td
                    key={day}
                    className={styles.slot}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(date, slot)}
                  >
                    {schedule[date]?.[slot]?.map(item => (
                      <div key={item.restaurantId} className={styles.scheduledItem}>
                        {item.restaurantName}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 4. Preenchimento Automático Inteligente

**Arquivo:** `src/app/carteira/actions-intelligent.ts`

```typescript
export async function autoFillWeeklySchedule(
  sellerId: string,
  weekStart: string
): Promise<FillSuggestion[]> {
  // 1. Buscar restaurantes do executivo
  const restaurants = await prisma.restaurant.findMany({
    where: { sellerId },
    include: {
      visits: {
        orderBy: { visitDate: 'desc' },
        take: 5
      },
      followUps: {
        where: { completed: false },
        orderBy: { scheduledDate: 'asc' }
      }
    }
  });
  
  // 2. Analisar histórico de visitas
  const suggestions: FillSuggestion[] = [];
  
  for (const restaurant of restaurants) {
    // 2.1. Verificar se tem follow-up agendado
    const upcomingFollowUp = restaurant.followUps.find(f => {
      const followUpDate = new Date(f.scheduledDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return followUpDate >= new Date(weekStart) && followUpDate < weekEnd;
    });
    
    if (upcomingFollowUp) {
      suggestions.push({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        suggestedDate: upcomingFollowUp.scheduledDate,
        suggestedTime: 'tarde', // Padrão
        reason: 'Follow-up agendado',
        confidence: 0.9
      });
      continue;
    }
    
    // 2.2. Analisar padrão de visitas anteriores
    if (restaurant.visits.length > 0) {
      const lastVisit = restaurant.visits[0];
      const daysSinceLastVisit = Math.floor(
        (Date.now() - new Date(lastVisit.visitDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Se passou mais de 30 dias, sugerir visita
      if (daysSinceLastVisit > 30) {
        const avgDaysBetweenVisits = calculateAvgDaysBetweenVisits(restaurant.visits);
        const suggestedDate = new Date(lastVisit.visitDate);
        suggestedDate.setDate(suggestedDate.getDate() + avgDaysBetweenVisits);
        
        suggestions.push({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          suggestedDate: suggestedDate.toISOString(),
          suggestedTime: inferBestTime(restaurant.visits),
          reason: `Última visita há ${daysSinceLastVisit} dias`,
          confidence: 0.7
        });
      }
    }
    
    // 2.3. Priorizar por status e potencial
    if (restaurant.status === 'Qualificado' && restaurant.salesPotential === 'ALTÍSSIMO') {
      suggestions.push({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        suggestedDate: new Date(weekStart).toISOString(),
        suggestedTime: 'manha',
        reason: 'Lead quente - prioridade alta',
        confidence: 0.8
      });
    }
  }
  
  // 3. Ordenar por confiança e prioridade
  suggestions.sort((a, b) => b.confidence - a.confidence);
  
  return suggestions;
}
```

### 5. Mapa Tecnológico

**Arquivo:** `src/app/carteira/MapaTecnologico.tsx`

```typescript
'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapaTecnologico({ restaurants, filters }) {
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  
  // Filtrar restaurantes com coordenadas
  const restaurantsWithCoords = restaurants.filter(r => r.latitude && r.longitude);
  
  // Calcular centro do mapa (média das coordenadas)
  const center = useMemo(() => {
    if (restaurantsWithCoords.length === 0) return [-23.5505, -46.6333]; // SP padrão
    
    const avgLat = restaurantsWithCoords.reduce((sum, r) => sum + (r.latitude || 0), 0) / restaurantsWithCoords.length;
    const avgLng = restaurantsWithCoords.reduce((sum, r) => sum + (r.longitude || 0), 0) / restaurantsWithCoords.length;
    
    return [avgLat, avgLng];
  }, [restaurantsWithCoords]);
  
  // Cor do marcador por status
  const getMarkerColor = (status: string) => {
    const colors: Record<string, string> = {
      'A Analisar': '#64748b',
      'Qualificado': '#3b82f6',
      'Contatado': '#f59e0b',
      'Negociação': '#8b5cf6',
      'Fechado': '#22c55e'
    };
    return colors[status] || '#64748b';
  };
  
  return (
    <div className={styles.mapContainer}>
      <MapContainer
        center={center as [number, number]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        
        {restaurantsWithCoords.map(restaurant => (
          <Marker
            key={restaurant.id}
            position={[restaurant.latitude!, restaurant.longitude!]}
            eventHandlers={{
              click: () => setSelectedRestaurant(restaurant)
            }}
          >
            <Popup>
              <div>
                <h3>{restaurant.name}</h3>
                <p>{restaurant.address?.city}</p>
                <p>Status: {restaurant.status}</p>
                <button onClick={() => router.push(`/restaurant/${restaurant.id}`)}>
                  Ver detalhes
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {selectedRestaurant && (
        <RestaurantDetailsModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
        />
      )}
    </div>
  );
}
```

### 6. Clientes Fixos

**Estrutura:**
```typescript
interface FixedClient {
  id: string;
  sellerId: string;
  restaurantId?: string; // Se for da base
  clientName?: string; // Se cadastrado manualmente
  recurrenceType: 'monthly_days' | 'weekly_days';
  monthlyDays: number[]; // [2, 14]
  weeklyDays: number[]; // [1, 4]
  radiusKm: number;
  latitude?: number;
  longitude?: number;
}
```

**Funcionalidades:**
- Cadastrar cliente fixo (da base ou manual)
- Configurar recorrência (mensal ou semanal)
- Sugerir restaurantes próximos
- Agrupar visitas no mesmo dia

### 7. Exportações

#### 7.1. Exportar para Checkmob
```typescript
export async function exportRestaurantsToCheckmob(restaurantIds: string[]) {
  // Formato específico do sistema Checkmob
  // Retornar arquivo Excel ou CSV
}
```

#### 7.2. Exportar Agendamento
```typescript
export async function exportWeeklyScheduleToAgendamentoTemplate(
  sellerId: string,
  weekStart: string
) {
  // Template específico de agendamento
  // Retornar arquivo Excel formatado
}
```

## Funcionalidades Adicionais

1. **Busca Avançada:**
   - Por nome
   - Por cidade
   - Por CEP
   - Por status
   - Por potencial

2. **Ações em Lote:**
   - Mudar status
   - Atribuir executivo
   - Criar follow-ups
   - Exportar selecionados

3. **Estatísticas:**
   - Por executivo
   - Por período
   - Taxa de conversão
   - Tempo médio no pipeline

## Testes

1. Filtrar por executivo
2. Filtrar por status/potencial
3. Arrastar restaurante para calendário
4. Preenchimento automático
5. Visualizar no mapa
6. Exportar agendamento

## Próximo Módulo

Após concluir este módulo, seguir para: **MÓDULO 7: DASHBOARD E RELATÓRIOS**
