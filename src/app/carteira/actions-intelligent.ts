'use server';

import { prisma } from '@/lib/db';
import { getFixedClientsForWeek, findNearbyProspectClients } from './actions';

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

        // Buscar clientes fixos da semana (com tratamento de erro)
        let fixedClientsByDay: { [date: string]: Array<{
            id: string;
            restaurantId: string;
            restaurantName: string;
            restaurantAddress: any;
            radiusKm: number;
            latitude: number | null;
            longitude: number | null;
        }> } = {};
        
        try {
            fixedClientsByDay = await getFixedClientsForWeek(sellerId, weekStart.toISOString()) || {};
            console.log(`\n📌 Clientes fixos encontrados para a semana:`, Object.keys(fixedClientsByDay).length, 'dias');
            
            // Log detalhado de quais dias têm clientes fixos
            Object.keys(fixedClientsByDay).forEach(date => {
                const clients = fixedClientsByDay[date];
                if (clients && clients.length > 0) {
                    console.log(`   📅 ${date}: ${clients.length} cliente(s) fixo(s)`);
                    clients.forEach(fc => {
                        console.log(`      - ${fc.restaurantName} (raio: ${fc.radiusKm}km)`);
                    });
                }
            });
        } catch (error) {
            console.warn('Erro ao buscar clientes fixos (tabela pode não existir ainda):', error);
            fixedClientsByDay = {};
        }

        // Gerar dias da semana (segunda a sexta)
        const weekDays: WeeklySchedule[] = [];
        const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        
        // Separar restaurantes já usados (clientes fixos e agendamentos existentes)
        const usedRestaurantIds = new Set<string>();
        existingSchedule.forEach(existing => {
            if (existing.restaurantId) {
                usedRestaurantIds.add(existing.restaurantId);
            }
        });
        
        // Adicionar IDs dos clientes fixos
        Object.values(fixedClientsByDay).forEach(fixedClients => {
            fixedClients.forEach(fc => {
                usedRestaurantIds.add(fc.restaurantId);
            });
        });
        
        for (let i = 0; i < 5; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            
            // Criar slots (8 slots por dia, sem horários específicos)
            const slots = [];
            const visitSlots = [1, 2, 3, 4, 5, 6, 7, 8];
            
            // Verificar se há clientes fixos neste dia
            const fixedClientsToday = fixedClientsByDay[dateString] || [];
            let fixedClientIndex = 0;
            
            for (const visitIndex of visitSlots) {
                // Verificar se já existe um agendamento neste slot
                const existingAtThisSlot = existingSchedule.find(existing => {
                    const existingDate = new Date(existing.scheduledDate);
                    const existingDateString = existingDate.toISOString().split('T')[0];
                    return existingDateString === dateString;
                });

                if (existingAtThisSlot) {
                    // Slot já preenchido com agendamento existente
                    slots.push({
                        time: String(visitIndex),
                        restaurantId: existingAtThisSlot.restaurantId,
                        restaurantName: existingAtThisSlot.restaurant?.name || 'Restaurante',
                        existingId: existingAtThisSlot.id,
                    });
                    if (existingAtThisSlot.restaurantId) {
                        usedRestaurantIds.add(existingAtThisSlot.restaurantId);
                    }
                } else if (fixedClientIndex < fixedClientsToday.length) {
                    // Preencher com cliente fixo
                    const fixedClient = fixedClientsToday[fixedClientIndex];
                    slots.push({
                        time: String(visitIndex),
                        restaurantId: fixedClient.restaurantId,
                        restaurantName: fixedClient.restaurantName,
                        isFixedClient: true, // Marcar como cliente fixo
                    });
                    fixedClientIndex++;
                } else {
                    // Slot vazio
                    slots.push({
                        time: String(visitIndex),
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

        // Distribuir restaurantes nos slots
        // Primeiro: preencher dias com clientes fixos usando clientes próximos
        console.log(`\n🔄 Iniciando distribuição de restaurantes...`);
        console.log(`📆 Total de dias da semana: ${weekDays.length}`);
        
        for (const day of weekDays) {
            const fixedClientsToday = fixedClientsByDay[day.date] || [];
            
            console.log(`\n🔍 Verificando ${day.day} (${day.date}):`);
            console.log(`   Clientes fixos encontrados: ${fixedClientsToday.length}`);
            
            if (fixedClientsToday.length > 0) {
                // IMPORTANTE: Criar um Set local para este dia específico
                // Isso permite que o mesmo restaurante seja visitado em dias diferentes
                // mas evita duplicatas no mesmo dia
                const usedInThisDay = new Set<string>();
                
                console.log(`\n📅 Processando ${day.day} (${day.date})`);
                console.log(`   Clientes fixos: ${fixedClientsToday.length}`);
                
                // Para cada cliente fixo, buscar clientes próximos
                for (const fixedClient of fixedClientsToday) {
                    // Buscar clientes próximos usando distância geográfica real
                    const nearbyClients = await findNearbyProspectClients(
                        {
                            id: fixedClient.id,
                            restaurantId: fixedClient.restaurantId,
                            restaurantName: fixedClient.restaurantName,
                            restaurantAddress: fixedClient.restaurantAddress,
                            clientAddress: fixedClient.restaurantAddress,
                            radiusKm: fixedClient.radiusKm,
                            latitude: fixedClient.latitude,
                            longitude: fixedClient.longitude
                        },
                        sellerId,
                        7 // Máximo 7 clientes próximos (8 slots - 1 cliente fixo)
                    );
                    
                    console.log(`   📍 Cliente fixo: ${fixedClient.restaurantName}`);
                    console.log(`      Coordenadas: ${fixedClient.latitude || 'N/A'}, ${fixedClient.longitude || 'N/A'}`);
                    console.log(`      Raio de busca: ${fixedClient.radiusKm}km`);
                    console.log(`      Encontrados: ${nearbyClients.length} restaurantes próximos`);
                    
                    if (nearbyClients.length === 0) {
                        console.log(`      ⚠️ NENHUM restaurante encontrado no raio de ${fixedClient.radiusKm}km!`);
                        console.log(`      💡 Verifique se há restaurantes com coordenadas próximas a este cliente fixo`);
                    }
                    
                    // Filtrar apenas os que:
                    // 1. Não são o próprio cliente fixo
                    // 2. Não foram usados NESTE dia específico (permite reusar em outros dias)
                    const availableNearbyClients = nearbyClients.filter(client => 
                        client.id !== fixedClient.restaurantId &&
                        !usedInThisDay.has(client.id)
                    );
                    
                    console.log(`      Disponíveis após filtro: ${availableNearbyClients.length}`);
                    
                    if (availableNearbyClients.length > 0) {
                        console.log(`      Top 3 restaurantes:`);
                        availableNearbyClients.slice(0, 3).forEach((r, idx) => {
                            const dist = r.distanceFromFixed || r.distance || 'N/A';
                            console.log(`         ${idx + 1}. ${r.name} (${typeof dist === 'number' ? dist.toFixed(2) : dist}km)`);
                        });
                    }
                    
                    // Preencher slots vazios do dia com clientes próximos
                    let filledCount = 0;
                    for (const slot of day.slots) {
                        if (!slot.restaurantId && filledCount < availableNearbyClients.length) {
                            const nearbyClient = availableNearbyClients[filledCount];
                            slot.restaurantId = nearbyClient.id;
                            slot.restaurantName = nearbyClient.name;
                            
                            // Adicionar distância e tempo do cliente fixo
                            if (nearbyClient.distanceFromFixed !== undefined) {
                                (slot as any).distanceFromFixed = nearbyClient.distanceFromFixed;
                            } else if (nearbyClient.distance !== undefined) {
                                (slot as any).distanceFromFixed = nearbyClient.distance;
                            }
                            
                            // Adicionar tempo estimado se disponível
                            if (nearbyClient.durationMinutes !== undefined) {
                                (slot as any).durationMinutes = nearbyClient.durationMinutes;
                            }
                            
                            // Marcar como usado APENAS neste dia
                            usedInThisDay.add(nearbyClient.id);
                            filledCount++;
                        }
                    }
                    
                    console.log(`      ✅ Preenchidos: ${filledCount} slots`);
                }
                
                // Contar quantos slots foram preenchidos no total neste dia
                const totalFilled = day.slots.filter(s => s.restaurantId).length;
                const emptySlots = day.slots.filter(s => !s.restaurantId).length;
                console.log(`   📊 Total de slots preenchidos em ${day.day}: ${totalFilled}/8`);
                if (emptySlots > 0) {
                    console.log(`   ⚠️ Ainda há ${emptySlots} slots vazios em ${day.day}`);
                }
            } else {
                console.log(`   ℹ️ Nenhum cliente fixo neste dia - será preenchido depois com restaurantes gerais`);
            }
        }
        
        console.log('\n✨ Preenchimento inteligente concluído!\n');
        
        // Segundo: preencher dias restantes com lógica atual (prioridade por score)
        // IMPORTANTE: Só preencher dias que NÃO têm clientes fixos, para evitar misturar
        // restaurantes distantes com os agrupados por proximidade
        let restaurantIndex = 0;
        const availableRestaurants = scoredRestaurants.filter(sr => !usedRestaurantIds.has(sr.restaurant.id));
        
        // Identificar dias que têm clientes fixos (já foram preenchidos com lógica de proximidade)
        const daysWithFixedClients = new Set<string>();
        Object.keys(fixedClientsByDay).forEach(date => {
            if (fixedClientsByDay[date] && fixedClientsByDay[date].length > 0) {
                daysWithFixedClients.add(date);
            }
        });
        
        console.log(`📆 Total de slots disponíveis: ${weekDays.reduce((sum, day) => sum + day.slots.filter(s => !s.restaurantId).length, 0)}`);
        console.log(`📝 Restaurantes disponíveis para agendar: ${availableRestaurants.length}`);
        console.log(`📌 Dias com clientes fixos (já otimizados): ${daysWithFixedClients.size}`);

        for (const scoredRestaurant of availableRestaurants) {
            const restaurant = scoredRestaurant.restaurant;
            
            // PRIORIDADE: Preencher primeiro os dias SEM clientes fixos
            // Depois, se necessário, preencher dias com clientes fixos que ainda têm slots vazios
            let found = false;
            
            // 1. Tentar preencher dias SEM clientes fixos primeiro
            for (const day of weekDays) {
                if (daysWithFixedClients.has(day.date)) continue; // Pular dias com clientes fixos
                
                const emptySlot = day.slots.find(slot => !slot.restaurantId);
                if (emptySlot) {
                    emptySlot.restaurantId = restaurant.id;
                    emptySlot.restaurantName = restaurant.name;
                    usedRestaurantIds.add(restaurant.id);
                    restaurantIndex++;
                    found = true;
                    break;
                }
            }
            
            // 2. Se não encontrou em dias sem clientes fixos, preencher dias com clientes fixos que ainda têm espaço
            if (!found) {
                for (const day of weekDays) {
                    const emptySlot = day.slots.find(slot => !slot.restaurantId);
                    if (emptySlot) {
                        emptySlot.restaurantId = restaurant.id;
                        emptySlot.restaurantName = restaurant.name;
                        usedRestaurantIds.add(restaurant.id);
                        restaurantIndex++;
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) break; // Não há mais slots disponíveis
        }

        const totalScheduled = weekDays.reduce((sum, day) => sum + day.slots.filter(s => s.restaurantId).length, 0);
        console.log(`✅ Agenda gerada com ${totalScheduled} restaurantes agendados`);
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

