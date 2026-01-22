# 📊 MÓDULO 5: PIPELINE E STATUS

## Objetivo
Implementar sistema de pipeline de vendas com visualização Kanban e gestão de status.

## Passos de Implementação

### 1. Definir Status do Pipeline

**Status (ordem):**
1. **"A Analisar"** - Recém importado, aguardando análise
2. **"Qualificado"** - Analisado e considerado viável
3. **"Contatado"** - Primeiro contato realizado
4. **"Negociação"** - Em processo de negociação
5. **"Fechado"** - Negócio fechado

### 2. Criar Server Action de Atualização de Status

**Arquivo:** `src/app/actions.ts`

```typescript
export async function updateRestaurantStatus(id: string, newStatus: string) {
  'use server';
  
  // 1. Validar status
  const validStatuses = ['A Analisar', 'Qualificado', 'Contatado', 'Negociação', 'Fechado'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Status inválido');
  }
  
  // 2. Buscar restaurante
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, name: true, status: true }
  });
  
  if (!restaurant) {
    throw new Error('Restaurante não encontrado');
  }
  
  // 3. Atualizar status
  await prisma.restaurant.update({
    where: { id },
    data: { status: newStatus }
  });
  
  // 4. Criar notificação automática se necessário
  if (newStatus === 'Fechado') {
    await createSystemNotification(
      'success',
      '🎉 Negócio Fechado!',
      `${restaurant.name} foi convertido com sucesso!`,
      { restaurantId: id }
    );
  } else if (newStatus === 'Qualificado') {
    await createSystemNotification(
      'lead',
      '🎯 Lead Qualificado',
      `${restaurant.name} foi qualificado para abordagem comercial.`,
      { restaurantId: id }
    );
  }
  
  // 5. Registrar no log de atividades
  await prisma.activityLog.create({
    data: {
      type: 'status_change',
      title: 'Status atualizado',
      description: `${restaurant.name}: ${restaurant.status} → ${newStatus}`,
      restaurantId: id,
      metadata: {
        oldStatus: restaurant.status,
        newStatus: newStatus
      }
    }
  });
  
  // 6. Invalidar cache
  revalidatePath('/pipeline');
  revalidatePath(`/restaurant/${id}`);
  revalidatePath('/clients');
  
  return { success: true };
}
```

### 3. Criar Função de Busca de Dados do Pipeline

**Arquivo:** `src/app/pipeline/actions.ts`

```typescript
export interface EnrichedRestaurant extends Restaurant {
  analysis?: AnalysisResult | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  nextAction?: string;
  daysInStage: number;
}

export interface PipelineMetrics {
  total: number;
  byStage: {
    'A Analisar': number;
    'Qualificado': number;
    'Contatado': number;
    'Negociação': number;
    'Fechado': number;
  };
  avgScore: number;
  hotLeads: number;
}

export async function getPipelineData(): Promise<{
  restaurants: EnrichedRestaurant[];
  metrics: PipelineMetrics;
}> {
  // 1. Buscar todos os restaurantes
  const restaurants = await getRestaurants();
  
  // 2. Buscar análises (limitar para performance)
  const analysesPromises = restaurants.slice(0, 200).map(r => getAnalysis(r.id));
  const analyses = await Promise.all(analysesPromises);
  
  // 3. Enriquecer restaurantes
  const enrichedRestaurants: EnrichedRestaurant[] = restaurants.map((r, i) => {
    const analysis = i < 200 ? analyses[i] : null;
    const score = analysis?.score || 0;
    
    // Calcular prioridade
    let priority: 'urgent' | 'high' | 'medium' | 'low' = 'low';
    if (r.salesPotential === 'ALTÍSSIMO' || score >= 70) {
      priority = 'urgent';
    } else if (r.salesPotential === 'ALTO' || score >= 50) {
      priority = 'high';
    } else if (r.salesPotential === 'MÉDIO' || score >= 30) {
      priority = 'medium';
    }
    
    // Calcular dias no estágio (mock - implementar tracking real)
    const daysInStage = r.updatedAt 
      ? Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Determinar próxima ação
    let nextAction = 'Analisar com IA';
    if (analysis && analysis.score > 0) {
      if (r.status === 'A Analisar') nextAction = 'Qualificar lead';
      else if (r.status === 'Qualificado') nextAction = 'Primeiro contato';
      else if (r.status === 'Contatado') nextAction = 'Agendar apresentação';
      else if (r.status === 'Negociação') nextAction = 'Enviar proposta';
      else if (r.status === 'Fechado') nextAction = 'Pós-venda';
    }
    
    return {
      ...r,
      analysis,
      priority,
      daysInStage,
      nextAction
    };
  });
  
  // 4. Calcular métricas
  const validAnalyses = analyses.filter(a => a && a.score > 0);
  const metrics: PipelineMetrics = {
    total: restaurants.length,
    byStage: {
      'A Analisar': restaurants.filter(r => r.status === 'A Analisar').length,
      'Qualificado': restaurants.filter(r => r.status === 'Qualificado').length,
      'Contatado': restaurants.filter(r => r.status === 'Contatado').length,
      'Negociação': restaurants.filter(r => r.status === 'Negociação').length,
      'Fechado': restaurants.filter(r => r.status === 'Fechado').length
    },
    avgScore: validAnalyses.length > 0
      ? validAnalyses.reduce((sum, a) => sum + (a?.score || 0), 0) / validAnalyses.length
      : 0,
    hotLeads: restaurants.filter(r => 
      r.salesPotential === 'ALTÍSSIMO' || 
      (validAnalyses.find(a => a?.restaurantId === r.id)?.score || 0) >= 70
    ).length
  };
  
  return { restaurants: enrichedRestaurants, metrics };
}
```

### 4. Criar Componente Kanban

**Arquivo:** `src/app/pipeline/PipelineClient.tsx`

```typescript
'use client';

const STAGES = [
  { id: 'A Analisar', label: 'A Analisar', icon: '🔍', color: '#64748b' },
  { id: 'Qualificado', label: 'Qualificado', icon: '✅', color: '#3b82f6' },
  { id: 'Contatado', label: 'Contatado', icon: '📞', color: '#f59e0b' },
  { id: 'Negociação', label: 'Negociação', icon: '🤝', color: '#8b5cf6' },
  { id: 'Fechado', label: 'Fechado', icon: '🎉', color: '#22c55e' }
];

export default function PipelineClient({ initialRestaurants, initialMetrics }) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    seller: 'all',
    priority: 'all',
    search: ''
  });
  
  // Filtrar restaurantes
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r => {
      if (filters.seller !== 'all' && r.seller?.id !== filters.seller) return false;
      if (filters.priority !== 'all' && r.priority !== filters.priority) return false;
      if (filters.search && !r.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [restaurants, filters]);
  
  // Agrupar por estágio
  const restaurantsByStage = useMemo(() => {
    const grouped: Record<string, EnrichedRestaurant[]> = {};
    STAGES.forEach(stage => {
      grouped[stage.id] = filteredRestaurants.filter(r => r.status === stage.id);
    });
    return grouped;
  }, [filteredRestaurants]);
  
  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedId) return;
    
    // Optimistic update
    setRestaurants(prev => prev.map(r =>
      r.id === draggedId ? { ...r, status: newStatus as any } : r
    ));
    
    // Persistir
    await updateRestaurantStatus(draggedId, newStatus);
    setDraggedId(null);
  };
  
  return (
    <div className={styles.pipeline}>
      {/* Filtros */}
      <div className={styles.filters}>
        {/* Filtros aqui */}
      </div>
      
      {/* Métricas */}
      <div className={styles.metrics}>
        {/* Métricas aqui */}
      </div>
      
      {/* Kanban Board */}
      <div className={styles.kanban}>
        {STAGES.map(stage => (
          <div
            key={stage.id}
            className={styles.column}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className={styles.columnHeader}>
              <span>{stage.icon}</span>
              <h3>{stage.label}</h3>
              <span className={styles.count}>
                {restaurantsByStage[stage.id]?.length || 0}
              </span>
            </div>
            
            <div className={styles.cards}>
              {restaurantsByStage[stage.id]?.map(restaurant => (
                <div
                  key={restaurant.id}
                  className={styles.card}
                  draggable
                  onDragStart={(e) => handleDragStart(e, restaurant.id)}
                  onClick={() => openQuickView(restaurant.id)}
                >
                  <div className={styles.cardHeader}>
                    <h4>{restaurant.name}</h4>
                    <span className={styles.priority} data-priority={restaurant.priority}>
                      {restaurant.priority}
                    </span>
                  </div>
                  
                  <div className={styles.cardBody}>
                    <p>{restaurant.address?.city}</p>
                    {restaurant.analysis && (
                      <div className={styles.score}>
                        Score: {restaurant.analysis.score}/100
                      </div>
                    )}
                    <div className={styles.nextAction}>
                      {restaurant.nextAction}
                    </div>
                  </div>
                  
                  <div className={styles.cardFooter}>
                    <span>{restaurant.seller?.name || 'Sem executivo'}</span>
                    <span>{restaurant.daysInStage}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Criar Modal de Quick View

**Funcionalidades:**
- Ver detalhes básicos do restaurante
- Mudar status (dropdown)
- Mudar prioridade
- Criar follow-up rápido
- Ver análise (se houver)
- Link para página completa

### 6. Estilização

**Cores por Status:**
- A Analisar: Cinza (#64748b)
- Qualificado: Azul (#3b82f6)
- Contatado: Laranja (#f59e0b)
- Negociação: Roxo (#8b5cf6)
- Fechado: Verde (#22c55e)

**Prioridades:**
- Urgent: Vermelho
- High: Laranja
- Medium: Amarelo
- Low: Cinza

## Funcionalidades Adicionais

1. **Filtros Avançados:**
   - Por executivo
   - Por prioridade
   - Por potencial de vendas
   - Por busca textual
   - Por período

2. **Ordenação:**
   - Por prioridade
   - Por score
   - Por data de atualização
   - Por nome

3. **Ações em Lote:**
   - Mudar status de múltiplos
   - Atribuir executivo em lote
   - Exportar selecionados

## Testes

1. Arrastar card entre colunas
2. Mudar status via dropdown
3. Filtrar restaurantes
4. Visualizar métricas
5. Quick view

## Próximo Módulo

Após concluir este módulo, seguir para: **MÓDULO 6: CARTEIRA E EXECUTIVOS**
