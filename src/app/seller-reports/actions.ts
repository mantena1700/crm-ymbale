'use server';

import { prisma } from '@/lib/db';
import { generateReportInsights } from '@/lib/openai-service';

export async function generateSellerReport(sellerId: string) {
    const seller = await prisma.seller.findUnique({
        where: { id: sellerId }
    });

    if (!seller) {
        throw new Error('Vendedor não encontrado');
    }

    // Buscar todos os restaurantes do vendedor
    const restaurants = await prisma.restaurant.findMany({
        where: { sellerId },
        include: {
            visits: {
                orderBy: { visitDate: 'desc' }
            },
            analyses: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });

    // Buscar visitas
    const visits = await prisma.visit.findMany({
        where: { sellerId }
    });

    // Calcular estatísticas
    const totalClients = restaurants.length;
    const qualifiedClients = restaurants.filter(r => r.status === 'Qualificado').length;
    const totalVisits = visits.length;
    const totalPotential = restaurants.reduce((sum, r) => sum + (r.projectedDeliveries || 0), 0);

    // Top 5 clientes por potencial
    const topClients = restaurants
        .sort((a, b) => (b.projectedDeliveries || 0) - (a.projectedDeliveries || 0))
        .slice(0, 5)
        .map(r => ({
            id: r.id,
            name: r.name,
            rating: Number(r.rating || 0),
            projectedDeliveries: r.projectedDeliveries || 0,
            status: r.status || 'A Analisar'
        }));

    // Preparar dados para IA
    const sellerData = {
        name: seller.name,
        totalClients,
        qualifiedClients,
        totalVisits,
        totalPotential,
        regions: seller.regions as string[],
        topClients: topClients.map(c => ({
            name: c.name,
            potential: c.projectedDeliveries,
            status: c.status
        })),
        visitsByOutcome: {
            positive: visits.filter(v => v.outcome === 'positive').length,
            neutral: visits.filter(v => v.outcome === 'neutral').length,
            negative: visits.filter(v => v.outcome === 'negative').length,
            scheduled: visits.filter(v => v.outcome === 'scheduled').length,
        }
    };

    // Gerar insights com IA
    let aiInsights = '';
    let recommendations: string[] = [];

    try {
        const prompt = `Analise os dados do vendedor ${seller.name} e gere um relatório executivo:

Dados:
- Total de clientes: ${totalClients}
- Clientes qualificados: ${qualifiedClients}
- Visitas realizadas: ${totalVisits}
- Potencial total: ${totalPotential} entregas/mês
- Regiões atendidas: ${(seller.regions as string[]).join(', ')}
- Visitas positivas: ${sellerData.visitsByOutcome.positive}
- Visitas neutras: ${sellerData.visitsByOutcome.neutral}
- Visitas negativas: ${sellerData.visitsByOutcome.negative}
- Visitas agendadas: ${sellerData.visitsByOutcome.scheduled}

Top 5 clientes:
${topClients.map((c, i) => `${i + 1}. ${c.name} - ${c.projectedDeliveries} entregas/mês - Status: ${c.status}`).join('\n')}

Gere:
1. Uma análise executiva de 3-4 parágrafos sobre a performance do vendedor
2. Pontos fortes identificados
3. Áreas de melhoria
4. Recomendações estratégicas (lista de 5-7 itens)

Formato: Texto direto, sem markdown, em português brasileiro.`;

        console.log('🔍 Gerando relatório com IA para vendedor:', seller.name);
        aiInsights = await generateReportInsights(prompt);
        console.log('✅ Relatório gerado com sucesso');

        // Extrair recomendações (últimas linhas geralmente são recomendações)
        const lines = aiInsights.split('\n');
        const recStart = lines.findIndex(l => l.toLowerCase().includes('recomendação') || l.toLowerCase().includes('ação'));
        if (recStart >= 0) {
            recommendations = lines.slice(recStart + 1)
                .filter(l => l.trim() && (l.includes('-') || l.includes('•') || l.match(/^\d+\./)))
                .map(l => l.replace(/^[-•\d.\s]+/, '').trim())
                .filter(l => l.length > 10)
                .slice(0, 7);
        }
    } catch (error: any) {
        console.error('❌ Erro ao gerar insights com IA:', error);
        const errorMessage = error?.message || 'Erro desconhecido';
        aiInsights = `Não foi possível gerar análise com IA no momento.\n\nErro: ${errorMessage}\n\nPor favor, verifique se a chave da API OpenAI está configurada corretamente.`;
    }

    return {
        sellerName: seller.name,
        totalClients,
        qualifiedClients,
        totalVisits,
        totalPotential,
        topClients,
        aiInsights,
        recommendations: recommendations.length > 0 ? recommendations : [
            'Focar em qualificar mais clientes da região',
            'Aumentar frequência de visitas aos top clientes',
            'Desenvolver estratégias específicas por região',
            'Melhorar follow-up após visitas positivas'
        ]
    };
}

