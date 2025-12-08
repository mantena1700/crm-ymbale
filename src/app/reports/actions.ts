'use server';

import { getRestaurants, getAnalysis, getGoals, getFollowUps } from '@/lib/db-data';
import { Restaurant, AnalysisResult } from '@/lib/types';

export interface ReportMetrics {
    totalRestaurants: number;
    analyzedCount: number;
    qualifiedCount: number;
    highPotentialCount: number;
    mediumPotentialCount: number;
    lowPotentialCount: number;
    avgScore: number;
    totalProjectedDeliveries: number;
    byStatus: { status: string; count: number }[];
    byRegion: { region: string; count: number }[];
    byCategory: { category: string; count: number }[];
    topRestaurants: { name: string; score: number; potential: string }[];
    recentAnalyses: { name: string; date: string; score: number }[];
    conversionFunnel: { stage: string; count: number; percentage: number }[];
}

export async function getReportMetrics(): Promise<ReportMetrics> {
    const restaurants = await getRestaurants();
    
    // Get all analyses
    const analyses: (AnalysisResult | null)[] = await Promise.all(
        restaurants.slice(0, 100).map(r => getAnalysis(r.id))
    );
    
    const validAnalyses = analyses.filter((a): a is AnalysisResult => a !== null && a.score > 0);
    
    // Calculate metrics
    const qualifiedCount = restaurants.filter(r => r.status === 'Qualificado').length;
    const highPotential = restaurants.filter(r => r.salesPotential === 'ALTÍSSIMO' || r.salesPotential === 'ALTO');
    const mediumPotential = restaurants.filter(r => r.salesPotential === 'MÉDIO');
    const lowPotential = restaurants.filter(r => r.salesPotential === 'BAIXO');
    
    // By status
    const statusCounts = new Map<string, number>();
    restaurants.forEach(r => {
        const status = r.status || 'A Analisar';
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });
    
    // By region (state)
    const regionCounts = new Map<string, number>();
    restaurants.forEach(r => {
        const region = r.address?.state || 'Não informado';
        regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    });
    
    // By category
    const categoryCounts = new Map<string, number>();
    restaurants.forEach(r => {
        const category = r.category || 'Outros';
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
    
    // Top restaurants by score
    const restaurantsWithScores = restaurants.map((r, i) => ({
        restaurant: r,
        analysis: analyses[i]
    })).filter(item => item.analysis && item.analysis.score > 0);
    
    const topRestaurants = restaurantsWithScores
        .sort((a, b) => (b.analysis?.score || 0) - (a.analysis?.score || 0))
        .slice(0, 10)
        .map(item => ({
            name: item.restaurant.name,
            score: item.analysis?.score || 0,
            potential: item.restaurant.salesPotential
        }));
    
    // Conversion funnel
    const total = restaurants.length;
    const funnel = [
        { stage: 'Leads Totais', count: total, percentage: 100 },
        { stage: 'Analisados', count: validAnalyses.length, percentage: Math.round((validAnalyses.length / total) * 100) },
        { stage: 'Qualificados', count: qualifiedCount, percentage: Math.round((qualifiedCount / total) * 100) },
        { stage: 'Em Negociação', count: restaurants.filter(r => r.status === 'Negociação').length, percentage: 0 },
        { stage: 'Fechados', count: restaurants.filter(r => r.status === 'Fechado').length, percentage: 0 }
    ];
    funnel[3].percentage = Math.round((funnel[3].count / total) * 100);
    funnel[4].percentage = Math.round((funnel[4].count / total) * 100);
    
    return {
        totalRestaurants: restaurants.length,
        analyzedCount: validAnalyses.length,
        qualifiedCount,
        highPotentialCount: highPotential.length,
        mediumPotentialCount: mediumPotential.length,
        lowPotentialCount: lowPotential.length,
        avgScore: validAnalyses.length > 0 
            ? Math.round(validAnalyses.reduce((sum, a) => sum + a.score, 0) / validAnalyses.length)
            : 0,
        totalProjectedDeliveries: restaurants.reduce((sum, r) => sum + (r.projectedDeliveries || 0), 0),
        byStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
        byRegion: Array.from(regionCounts.entries()).map(([region, count]) => ({ region, count })).slice(0, 10),
        byCategory: Array.from(categoryCounts.entries()).map(([category, count]) => ({ category, count })).slice(0, 10),
        topRestaurants,
        recentAnalyses: validAnalyses.slice(0, 5).map((a, i) => ({
            name: restaurants[i]?.name || 'Desconhecido',
            date: new Date().toLocaleDateString('pt-BR'),
            score: a.score
        })),
        conversionFunnel: funnel
    };
}

export interface ExportData {
    restaurants: {
        nome: string;
        categoria: string;
        cidade: string;
        estado: string;
        avaliacao: number;
        totalAvaliacoes: number;
        potencial: string;
        status: string;
        projecaoEntregas: number;
        score: number;
        doresIdentificadas: string;
    }[];
}

export async function getExportData(): Promise<ExportData> {
    const restaurants = await getRestaurants();
    const analyses = await Promise.all(
        restaurants.map(r => getAnalysis(r.id))
    );
    
    return {
        restaurants: restaurants.map((r, i) => ({
            nome: r.name,
            categoria: r.category || 'N/A',
            cidade: r.address?.city || 'N/A',
            estado: r.address?.state || 'N/A',
            avaliacao: r.rating,
            totalAvaliacoes: r.reviewCount,
            potencial: r.salesPotential,
            status: r.status || 'A Analisar',
            projecaoEntregas: r.projectedDeliveries,
            score: analyses[i]?.score || 0,
            doresIdentificadas: analyses[i]?.painPoints?.join('; ') || ''
        }))
    };
}

export async function generateAIInsights(metrics: ReportMetrics): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey.length < 50) {
        return `## Resumo Executivo

Com base nos dados analisados:
- **${metrics.totalRestaurants}** leads no pipeline
- **${metrics.analyzedCount}** restaurantes analisados pela IA
- **${metrics.qualifiedCount}** leads qualificados
- Score médio de **${metrics.avgScore}**/100

### Recomendações:
1. Priorize os ${metrics.highPotentialCount} leads de alto potencial
2. Foque nas categorias com mais leads
3. Continue analisando novos restaurantes`;
    }

    try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey });
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Você é um analista de negócios especializado em vendas B2B. Gere insights acionáveis baseados em métricas de CRM. Use markdown para formatar.'
                },
                {
                    role: 'user',
                    content: `Analise estas métricas do CRM e gere um relatório executivo com insights e recomendações:

MÉTRICAS:
- Total de Leads: ${metrics.totalRestaurants}
- Analisados: ${metrics.analyzedCount}
- Qualificados: ${metrics.qualifiedCount}
- Score Médio: ${metrics.avgScore}/100
- Alto Potencial: ${metrics.highPotentialCount}
- Médio Potencial: ${metrics.mediumPotentialCount}
- Baixo Potencial: ${metrics.lowPotentialCount}
- Projeção de Entregas/mês: ${metrics.totalProjectedDeliveries.toLocaleString()}

FUNIL DE CONVERSÃO:
${metrics.conversionFunnel.map(f => `- ${f.stage}: ${f.count} (${f.percentage}%)`).join('\n')}

TOP CATEGORIAS:
${metrics.byCategory.slice(0, 5).map(c => `- ${c.category}: ${c.count} leads`).join('\n')}

Gere um relatório executivo com:
1. Resumo da situação atual
2. 3-4 insights principais
3. Recomendações prioritárias
4. Próximos passos sugeridos

Máximo 400 palavras. Use markdown.`
                }
            ],
            temperature: 0.7,
            max_tokens: 800
        });

        return completion.choices[0]?.message?.content || 'Não foi possível gerar insights.';
    } catch (error) {
        console.error('AI Insights error:', error);
        return `## Resumo Automático

- **${metrics.totalRestaurants}** leads totais
- **${metrics.qualifiedCount}** qualificados
- Score médio: **${metrics.avgScore}**/100

Recomendação: Continue analisando leads com IA para aumentar a taxa de conversão.`;
    }
}

