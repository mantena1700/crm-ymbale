# 📈 MÓDULO 7: DASHBOARD E RELATÓRIOS

## Objetivo
Implementar dashboard principal com métricas, gráficos e relatórios do sistema.

## Passos de Implementação

### 1. Criar Função de Busca de Estatísticas

**Arquivo:** `src/lib/db-data.ts`

```typescript
export async function getDashboardStats() {
  const [
    totalRestaurants,
    qualifiedLeads,
    contactedLeads,
    negotiatingLeads,
    closedDeals,
    pendingAnalysis,
    hotLeads
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { status: 'Qualificado' } }),
    prisma.restaurant.count({ where: { status: 'Contatado' } }),
    prisma.restaurant.count({ where: { status: 'Negociação' } }),
    prisma.restaurant.count({ where: { status: 'Fechado' } }),
    prisma.restaurant.count({ where: { status: 'A Analisar' } }),
    prisma.restaurant.findMany({
      where: { salesPotential: 'ALTÍSSIMO' },
      take: 10,
      orderBy: { projectedDeliveries: 'desc' }
    })
  ]);
  
  const avgRatingResult = await prisma.restaurant.aggregate({
    _avg: { rating: true }
  });
  
  return {
    totalRestaurants,
    qualifiedLeads,
    contactedLeads,
    negotiatingLeads,
    closedDeals,
    pendingAnalysis,
    hotLeadsCount: hotLeads.length,
    avgRating: avgRatingResult._avg.rating 
      ? Number(avgRatingResult._avg.rating).toFixed(1) 
      : '0',
    hotLeads: hotLeads.map(r => ({
      id: r.id,
      name: r.name,
      rating: Number(r.rating || 0),
      reviewCount: r.reviewCount ?? 0,
      projectedDeliveries: r.projectedDeliveries ?? 0,
      salesPotential: r.salesPotential || 'N/A',
      address: r.address as any,
      status: r.status || undefined
    }))
  };
}
```

### 2. Criar Componente de Dashboard

**Arquivo:** `src/app/DashboardClientNew.tsx`

```typescript
'use client';

export default function DashboardClientNew({ stats }) {
  return (
    <div className={styles.dashboard}>
      {/* Cards de Métricas */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title="Total de Restaurantes"
          value={stats.totalRestaurants}
          icon="🏪"
          trend={null}
        />
        <MetricCard
          title="Leads Qualificados"
          value={stats.qualifiedLeads}
          icon="✅"
          trend="up"
        />
        <MetricCard
          title="Em Negociação"
          value={stats.negotiatingLeads}
          icon="🤝"
          trend={null}
        />
        <MetricCard
          title="Negócios Fechados"
          value={stats.closedDeals}
          icon="🎉"
          trend="up"
        />
        <MetricCard
          title="Rating Médio"
          value={stats.avgRating}
          icon="⭐"
          trend={null}
        />
        <MetricCard
          title="Leads Quentes"
          value={stats.hotLeadsCount}
          icon="🔥"
          trend={null}
        />
      </div>
      
      {/* Gráficos */}
      <div className={styles.chartsGrid}>
        <ChartCard title="Distribuição por Status">
          <PieChart data={[
            { name: 'A Analisar', value: stats.pendingAnalysis, color: '#64748b' },
            { name: 'Qualificado', value: stats.qualifiedLeads, color: '#3b82f6' },
            { name: 'Contatado', value: stats.contactedLeads, color: '#f59e0b' },
            { name: 'Negociação', value: stats.negotiatingLeads, color: '#8b5cf6' },
            { name: 'Fechado', value: stats.closedDeals, color: '#22c55e' }
          ]} />
        </ChartCard>
        
        <ChartCard title="Distribuição por Potencial">
          <BarChart data={stats.byPotential} />
        </ChartCard>
        
        <ChartCard title="Distribuição por Região">
          <BarChart data={stats.byRegion} />
        </ChartCard>
      </div>
      
      {/* Top Leads */}
      <div className={styles.topLeads}>
        <h2>🔥 Top 10 Leads Quentes</h2>
        <div className={styles.leadsList}>
          {stats.hotLeads.map(lead => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </div>
      
      {/* Próximos Follow-ups */}
      <div className={styles.upcomingFollowUps}>
        <h2>📅 Próximos Follow-ups</h2>
        <div className={styles.followUpsList}>
          {stats.upcomingFollowUps.map(followUp => (
            <FollowUpCard key={followUp.id} followUp={followUp} />
          ))}
        </div>
      </div>
      
      {/* Metas */}
      <div className={styles.goals}>
        <h2>🎯 Metas do Período</h2>
        <div className={styles.goalsList}>
          {stats.goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      </div>
      
      {/* Atividades Recentes */}
      <div className={styles.recentActivities}>
        <h2>📋 Atividades Recentes</h2>
        <div className={styles.activitiesList}>
          {stats.recentActivities.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 3. Criar Componentes de Gráficos

**Biblioteca Recomendada:** `recharts` ou `chart.js`

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export function PieChartComponent({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BarChartComponent({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 4. Criar Sistema de Relatórios

**Arquivo:** `src/app/reports/page.tsx`

**Tipos de Relatório:**

#### 4.1. Relatório por Executivo
```typescript
export async function getSellerReport(sellerId: string, period: string) {
  const startDate = getPeriodStart(period);
  const endDate = getPeriodEnd(period);
  
  const restaurants = await prisma.restaurant.findMany({
    where: {
      sellerId,
      createdAt: { gte: startDate, lte: endDate }
    },
    include: {
      visits: true,
      followUps: true,
      analyses: true
    }
  });
  
  return {
    seller: await prisma.seller.findUnique({ where: { id: sellerId } }),
    period: { start: startDate, end: endDate },
    metrics: {
      totalClients: restaurants.length,
      byStatus: groupBy(restaurants, 'status'),
      byPotential: groupBy(restaurants, 'salesPotential'),
      totalVisits: restaurants.reduce((sum, r) => sum + r.visits.length, 0),
      totalFollowUps: restaurants.reduce((sum, r) => sum + r.followUps.length, 0),
      conversionRate: calculateConversionRate(restaurants),
      avgTimeInPipeline: calculateAvgTimeInPipeline(restaurants)
    },
    restaurants: restaurants
  };
}
```

#### 4.2. Relatório por Período
```typescript
export async function getPeriodReport(period: string) {
  const startDate = getPeriodStart(period);
  const endDate = getPeriodEnd(period);
  
  const restaurants = await prisma.restaurant.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate }
    },
    include: {
      seller: true,
      visits: true
    }
  });
  
  return {
    period: { start: startDate, end: endDate },
    metrics: {
      newLeads: restaurants.length,
      conversions: restaurants.filter(r => r.status === 'Fechado').length,
      visits: restaurants.reduce((sum, r) => sum + r.visits.length, 0),
      bySeller: groupBy(restaurants, 'seller.name'),
      byRegion: groupBy(restaurants, 'address.city'),
      conversionRate: calculateConversionRate(restaurants)
    }
  };
}
```

#### 4.3. Relatório de Performance
```typescript
export async function getPerformanceReport() {
  const sellers = await prisma.seller.findMany({
    include: {
      restaurants: {
        include: {
          visits: true,
          analyses: true
        }
      }
    }
  });
  
  return sellers.map(seller => ({
    seller: {
      id: seller.id,
      name: seller.name
    },
    metrics: {
      totalClients: seller.restaurants.length,
      conversionRate: calculateConversionRate(seller.restaurants),
      avgScore: calculateAvgScore(seller.restaurants),
      totalVisits: seller.restaurants.reduce((sum, r) => sum + r.visits.length, 0),
      avgTimeInPipeline: calculateAvgTimeInPipeline(seller.restaurants)
    }
  }));
}
```

### 5. Exportação de Relatórios

```typescript
export async function exportReportToExcel(reportData: any, reportType: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Relatório');
  
  // Adicionar cabeçalho
  worksheet.addRow(['Relatório', reportType]);
  worksheet.addRow(['Data', new Date().toLocaleDateString('pt-BR')]);
  worksheet.addRow([]);
  
  // Adicionar dados
  if (reportType === 'seller') {
    worksheet.addRow(['Executivo', reportData.seller.name]);
    worksheet.addRow(['Período', `${reportData.period.start} a ${reportData.period.end}`]);
    worksheet.addRow([]);
    worksheet.addRow(['Métricas']);
    worksheet.addRow(['Total de Clientes', reportData.metrics.totalClients]);
    worksheet.addRow(['Taxa de Conversão', `${reportData.metrics.conversionRate}%`]);
    // ...
  }
  
  // Gerar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
```

### 6. Filtros e Períodos

```typescript
function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'today':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return weekStart;
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), quarter * 3, 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(0);
  }
}
```

## Funcionalidades Adicionais

1. **Filtros Dinâmicos:**
   - Por período
   - Por executivo
   - Por região
   - Por status

2. **Comparações:**
   - Período anterior
   - Média do mês
   - Meta vs Realizado

3. **Alertas:**
   - Metas em risco
   - Leads sem contato há X dias
   - Follow-ups atrasados

## Testes

1. Carregar dashboard
2. Filtrar por período
3. Gerar relatório
4. Exportar relatório
5. Visualizar gráficos

## Próximo Módulo

Após concluir este módulo, seguir para: **MÓDULO 8: CAMPANHAS E WORKFLOWS**
