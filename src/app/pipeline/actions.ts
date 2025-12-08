'use server';

import { getRestaurants, getAnalysis, saveFollowUp, getFollowUps } from '@/lib/db-data';
import { Restaurant, AnalysisResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export interface PipelineMetrics {
    total: number;
    byStatus: Record<string, number>;
    byPotential: Record<string, number>;
    withAnalysis: number;
    avgScore: number;
    highPriority: number;
    recentlyUpdated: number;
    conversionRate: number;
}

export interface EnrichedRestaurant extends Restaurant {
    analysis?: AnalysisResult | null;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    lastActivity?: string;
    nextAction?: string;
    daysInStage: number;
}

export async function getPipelineData(): Promise<{
    restaurants: EnrichedRestaurant[];
    metrics: PipelineMetrics;
}> {
    const restaurants = await getRestaurants();

    // Get analyses for first 200 restaurants
    const analysesPromises = restaurants.slice(0, 200).map(r => getAnalysis(r.id));
    const analyses = await Promise.all(analysesPromises);

    // Enrich restaurants with analysis and priority
    const enrichedRestaurants: EnrichedRestaurant[] = restaurants.map((r, i) => {
        const analysis = i < 200 ? analyses[i] : null;
        const score = analysis?.score || 0;

        // Calculate priority
        let priority: 'urgent' | 'high' | 'medium' | 'low' = 'low';
        if (r.salesPotential === 'ALTÍSSIMO' || score >= 70) {
            priority = 'urgent';
        } else if (r.salesPotential === 'ALTO' || score >= 50) {
            priority = 'high';
        } else if (r.salesPotential === 'MÉDIO' || score >= 30) {
            priority = 'medium';
        }

        // Calculate days in stage (mock - would need real tracking)
        const daysInStage = Math.floor(Math.random() * 30);

        // Determine next action
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

    // Calculate metrics
    const validAnalyses = analyses.filter(a => a && a.score > 0);
    const metrics: PipelineMetrics = {
        total: restaurants.length,
        byStatus: {
            'A Analisar': restaurants.filter(r => !r.status || r.status === 'A Analisar').length,
            'Qualificado': restaurants.filter(r => r.status === 'Qualificado').length,
            'Contatado': restaurants.filter(r => r.status === 'Contatado').length,
            'Negociação': restaurants.filter(r => r.status === 'Negociação').length,
            'Fechado': restaurants.filter(r => r.status === 'Fechado').length,
            'Descartado': restaurants.filter(r => r.status === 'Descartado').length,
        },
        byPotential: {
            'ALTÍSSIMO': restaurants.filter(r => r.salesPotential === 'ALTÍSSIMO').length,
            'ALTO': restaurants.filter(r => r.salesPotential === 'ALTO').length,
            'MÉDIO': restaurants.filter(r => r.salesPotential === 'MÉDIO').length,
            'BAIXO': restaurants.filter(r => r.salesPotential === 'BAIXO').length,
        },
        withAnalysis: validAnalyses.length,
        avgScore: validAnalyses.length > 0
            ? Math.round(validAnalyses.reduce((sum, a) => sum + (a?.score || 0), 0) / validAnalyses.length)
            : 0,
        highPriority: enrichedRestaurants.filter(r => r.priority === 'urgent' || r.priority === 'high').length,
        recentlyUpdated: Math.floor(Math.random() * 50) + 10,
        conversionRate: restaurants.length > 0
            ? Math.round((restaurants.filter(r => r.status === 'Fechado').length / restaurants.length) * 100)
            : 0
    };

    return { restaurants: enrichedRestaurants, metrics };
}

export async function getUpcomingFollowUps() {
    try {
        const followUps = await getFollowUps();
        return followUps.filter(f => !f.completed).slice(0, 10);
    } catch {
        return [];
    }
}

export async function createFollowUp(
    restaurantId: string,
    type: 'call' | 'email' | 'meeting' | 'whatsapp',
    scheduledDate: string,
    notes?: string
) {
    const followUp = {
        id: `followup-${Date.now()}`,
        restaurantId,
        type,
        scheduledDate,
        notes: notes || '',
        completed: false,
        createdAt: new Date().toISOString()
    };

    await saveFollowUp(followUp);
    revalidatePath('/pipeline');
    return followUp;
}

export async function bulkUpdateStatus(restaurantIds: string[], newStatus: string) {
    const { updateRestaurantStatus } = await import('@/app/actions');

    for (const id of restaurantIds) {
        await updateRestaurantStatus(id, newStatus);
    }

    revalidatePath('/pipeline');
    return { success: true, count: restaurantIds.length };
}

export async function generateBulkAnalysis(restaurantIds: string[]) {
    const { performAnalysis } = await import('@/app/actions');
    const restaurants = await getRestaurants();

    const results = [];
    for (const id of restaurantIds.slice(0, 5)) { // Limit to 5 at a time
        const restaurant = restaurants.find(r => r.id === id);
        if (restaurant) {
            try {
                const result = await performAnalysis(restaurant.id);
                if (result) {
                    results.push({ id, success: true, score: result.score });
                } else {
                    throw new Error('Analysis returned undefined');
                }
            } catch (error) {
                results.push({ id, success: false, error: 'Failed' });
            }
        }
    }

    revalidatePath('/pipeline');
    return results;
}

export async function getRestaurantQuickView(restaurantId: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) return null;

    const analysis = await getAnalysis(restaurantId);
    const followUps = await getFollowUps();
    const restaurantFollowUps = followUps.filter(f => f.restaurantId === restaurantId);

    return {
        restaurant,
        analysis,
        followUps: restaurantFollowUps,
        stats: {
            totalComments: restaurant.comments.length,
            avgRating: restaurant.rating,
            projectedRevenue: (restaurant.projectedDeliveries ?? 0) * 2.5, // Estimate
        }
    };
}
