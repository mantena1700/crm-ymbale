'use server';

import { prisma } from '@/lib/db';

interface Restaurant {
    id: string;
    name: string;
    address?: any;
    salesPotential?: string | null;
    rating?: number;
    status?: string;
    projectedDeliveries?: number;
    reviewCount?: number;
}

interface WeeklySchedule {
    day: string;
    date: string;
    slots: Array<{
        time: string;
        restaurantId: string | null;
        restaurantName: string | null;
        existingId?: string; // ID do follow-up existente
    }>;
}

// Gerar preenchimento automático inteligente da semana
export async function generateIntelligentWeeklySchedule(
    restaurants: Restaurant[],
    sellerId: string,
    weekStart: Date,
    existingSchedule: any[] = []
): Promise<WeeklySchedule[]> {
    try {
        console.log('📅 Iniciando geração de agenda inteligente...');
        console.log(`📊 Total de restaurantes recebidos: ${restaurants.length}`);
        
        // Filtrar restaurantes válidos (menos restritivo)
        const validRestaurants = restaurants.filter(r => {
            // Apenas verificar se tem ID e nome
            if (!r.id || !r.name) return false;
            // Não incluir descartados
            if (r.status === 'Descartado') return false;
            return true;
        });

        console.log(`✅ Restaurantes válidos: ${validRestaurants.length}`);

        if (validRestaurants.length === 0) {
            console.log('⚠️ Nenhum restaurante válido encontrado');
            return [];
        }

        // Ordenar por prioridade (score combinado)
        const scoredRestaurants = validRestaurants.map(r => {
            let score = 0;
            
            // Prioridade por potencial de vendas
            const potential = r.salesPotential || '';
            if (potential === 'ALTISSIMO') score += 100;
            else if (potential === 'ALTO') score += 75;
            else if (potential === 'MEDIO') score += 50;
            else if (potential === 'BAIXO') score += 25;
            else score += 10; // Score base para restaurantes sem potencial definido
            
            // Prioridade por avaliação
            const rating = typeof r.rating === 'number' ? r.rating : 0;
            score += rating * 10;
            
            // Prioridade por número de avaliações (mais popular)
            const reviewCount = typeof r.reviewCount === 'number' ? r.reviewCount : 0;
            score += Math.min(reviewCount, 100) * 0.5;
            
            // Prioridade por projeção de entregas
            const projectedDeliveries = typeof r.projectedDeliveries === 'number' ? r.projectedDeliveries : 0;
            score += Math.min(projectedDeliveries / 100, 50);
            
            // Penalizar se já foi contatado recentemente
            const status = r.status || '';
            if (status === 'Contatado' || status === 'Negociação') {
                score *= 0.7;
            }
            
            return { restaurant: r, score };
        });
        
        console.log(`🎯 Restaurantes ordenados por score`);

        // Ordenar por score (maior primeiro)
        scoredRestaurants.sort((a, b) => b.score - a.score);

        // Gerar dias da semana (segunda a sexta)
        const weekDays: WeeklySchedule[] = [];
        const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        
        for (let i = 0; i < 5; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            
            // Criar slots de 8h às 18h (8 slots por dia) - usando os mesmos horários do WeeklyCalendar
            const slots = [];
            const timeSlots = [
                '08:00', '09:15', '10:30', '11:45',
                '13:00', '14:15', '15:30', '16:45'
            ];
            
            for (const time of timeSlots) {
                // Verificar se já existe um agendamento neste horário
                const existingAtThisTime = existingSchedule.find(existing => {
                    const existingDate = new Date(existing.scheduledDate);
                    const existingDateString = existingDate.toISOString().split('T')[0];
                    const existingTime = `${String(existingDate.getHours()).padStart(2, '0')}:${String(existingDate.getMinutes()).padStart(2, '0')}`;
                    return existingDateString === dateString && existingTime === time;
                });

                if (existingAtThisTime) {
                    // Slot já preenchido com agendamento existente
                    slots.push({
                        time,
                        restaurantId: existingAtThisTime.restaurantId,
                        restaurantName: existingAtThisTime.restaurant?.name || 'Restaurante',
                        existingId: existingAtThisTime.id, // Marcar como existente para não duplicar
                    });
                } else {
                    // Slot vazio
                    slots.push({
                        time,
                        restaurantId: null,
                        restaurantName: null,
                    });
                }
            }
            
            weekDays.push({
                day: daysOfWeek[i],
                date: dateString,
                slots,
            });
        }

        // Distribuir restaurantes nos slots (priorizando os melhores)
        let restaurantIndex = 0;
        const totalSlots = weekDays.reduce((sum, day) => sum + day.slots.length, 0);
        const restaurantsToSchedule = Math.min(scoredRestaurants.length, totalSlots);

        console.log(`📆 Total de slots disponíveis: ${totalSlots}`);
        console.log(`📝 Restaurantes a agendar: ${restaurantsToSchedule}`);

        for (let i = 0; i < restaurantsToSchedule && restaurantIndex < scoredRestaurants.length; i++) {
            const restaurant = scoredRestaurants[restaurantIndex].restaurant;
            
            // Encontrar próximo slot vazio
            for (const day of weekDays) {
                const emptySlot = day.slots.find(slot => !slot.restaurantId);
                if (emptySlot) {
                    emptySlot.restaurantId = restaurant.id;
                    emptySlot.restaurantName = restaurant.name;
                    restaurantIndex++;
                    break;
                }
            }
        }

        console.log(`✅ Agenda gerada com ${restaurantIndex} restaurantes agendados`);
        return weekDays;
    } catch (error) {
        console.error('❌ Erro ao gerar agenda inteligente:', error);
        throw error; // Propagar erro para tratamento adequado
    }
}

// Otimizar rota usando IA
export async function optimizeRouteWithAI(
    restaurants: Restaurant[],
    currentLocation?: { lat: number; lng: number }
): Promise<{
    route: Array<{
        restaurantId: string;
        restaurantName: string;
        address: string;
        order: number;
        distance?: number;
    }>;
    totalDistance: number;
    estimatedTime: number;
}> {
    try {
        // Se tiver localização atual, começar por ela
        const validRestaurants = restaurants.filter(r => 
            r.address && r.address.city
        );

        if (validRestaurants.length === 0) {
            return { route: [], totalDistance: 0, estimatedTime: 0 };
        }

        // Usar algoritmo de otimização simples (pode ser melhorado com IA)
        // Por enquanto, usar nearest neighbor
        const route: Array<{
            restaurantId: string;
            restaurantName: string;
            address: string;
            order: number;
            distance?: number;
        }> = [];

        // Se tiver localização atual, adicionar como ponto inicial
        let currentPoint = currentLocation;
        let remaining = [...validRestaurants];
        let totalDistance = 0;
        let order = 1;

        while (remaining.length > 0) {
            let nearestIndex = -1;
            let nearestDistance = Infinity;

            remaining.forEach((restaurant, index) => {
                // Calcular distância (simplificado - em produção usar API de distância)
                const address = `${restaurant.address.street || ''} ${restaurant.address.neighborhood || ''} ${restaurant.address.city || ''}`.trim();
                
                // Por enquanto, usar ordem de prioridade
                let distance = 0;
                if (currentPoint) {
                    // Distância estimada (seria calculada com API real)
                    distance = Math.random() * 10; // Placeholder
                }

                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            });

            if (nearestIndex !== -1) {
                const restaurant = remaining[nearestIndex];
                const address = `${restaurant.address.street || ''} ${restaurant.address.neighborhood || ''} ${restaurant.address.city || ''}`.trim();
                
                route.push({
                    restaurantId: restaurant.id,
                    restaurantName: restaurant.name,
                    address,
                    order: order++,
                    distance: nearestDistance > 0 ? Number(nearestDistance.toFixed(2)) : undefined,
                });

                totalDistance += nearestDistance;
                remaining.splice(nearestIndex, 1);
            } else {
                break;
            }
        }

        // Tempo estimado (assumindo 30km/h média + 15min por parada)
        const estimatedTime = (totalDistance / 30) * 60 + (route.length * 15);

        return {
            route,
            totalDistance: Number(totalDistance.toFixed(2)),
            estimatedTime: Math.round(estimatedTime),
        };
    } catch (error) {
        console.error('Erro ao otimizar rota:', error);
        return { route: [], totalDistance: 0, estimatedTime: 0 };
    }
}

