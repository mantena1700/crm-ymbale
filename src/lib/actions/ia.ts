'use server';

import { revalidatePath } from 'next/cache';
import { getRestaurants, getAnalysis, saveAnalysis } from '@/lib/db-data';
import { Restaurant } from '@/lib/types';
import { generateEmailWithAI as generateEmail, generateStrategyWithAI as generateStrategy, generateFollowUpMessageWithAI as generateFollowUp } from '@/lib/openai-service';
import { analyzeRestaurant } from '@/lib/ai-service';
import { createSystemNotification } from './clientes';

// Realizar análise IA de um cliente
export async function performAnalysis(id: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === id);

    if (restaurant) {
        const analysis = await analyzeRestaurant(restaurant);
        await saveAnalysis(id, analysis);

        // Criar notificação de análise concluída
        await createSystemNotification(
            'analysis',
            '🤖 Análise IA Concluída',
            `Análise de ${restaurant.name} finalizada. Score: ${analysis.score}/100`,
            { restaurantId: id, score: analysis.score }
        );

        // Notificação extra para leads quentes
        if (analysis.score >= 80) {
            await createSystemNotification(
                'lead',
                '🔥 Lead Quente Detectado!',
                `${restaurant.name} tem alto potencial (Score: ${analysis.score}). Priorizar contato!`,
                { restaurantId: id, score: analysis.score }
            );
        }

        revalidatePath(`/restaurant/${id}`);
        revalidatePath('/clients');
        return analysis;
    }
}

// Análise em lote
export async function analyzeBatch(restaurants: Restaurant[]) {
    for (const restaurant of restaurants) {
        await performAnalysis(restaurant.id);
    }
    revalidatePath('/batch-analysis');
    return { success: true };
}

// Gerar email com IA
export async function generateEmailWithAI(restaurantId: string, customInstructions?: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
        throw new Error('Restaurante não encontrado');
    }

    const analysis = await getAnalysis(restaurantId);
    const result = await generateEmail(restaurant, analysis, customInstructions);

    return result;
}

// Gerar estratégia com IA
export async function generateStrategyWithAI(restaurantId: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
        throw new Error('Restaurante não encontrado');
    }

    const analysis = await getAnalysis(restaurantId);
    const result = await generateStrategy(restaurant, analysis);

    return { strategy: result };
}

// Gerar mensagem de follow-up com IA
export async function generateFollowUpMessageWithAI(restaurantId: string, previousContact?: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
        throw new Error('Restaurante não encontrado');
    }

    const result = await generateFollowUp(restaurant, previousContact);

    return { message: result };
}
