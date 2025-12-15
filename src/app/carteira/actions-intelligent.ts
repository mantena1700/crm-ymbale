'use server';

import { prisma } from '@/lib/db';
import { getFixedClientsForWeek, findNearbyProspectClients } from './actions';
import { calculateDistance } from '@/lib/distance-calculator';
import type { FillSuggestion } from './ConfirmationModal';

// Constante para limite de visitas por dia
const MAX_VISITS_PER_DAY = 6;
const GRAVITY_MAX_DISTANCE_KM = 20; // Máxima distância para atrair restaurante para um dia

export interface UserDecision {
    suggestionId: string;
    accepted: boolean;
    selectedRestaurantIds?: string[];
}

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
    existingSchedule: any[] = [],
    userDecisions: UserDecision[] = []
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
            
            // Criar slots (6 slots por dia, sem horários específicos)
            const slots = [];
            const visitSlots = Array.from({ length: MAX_VISITS_PER_DAY }, (_, i) => i + 1);
            
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

        // Criar mapa de decisões do usuário por sugestão ID
        const decisionsMap = new Map<string, UserDecision>();
        userDecisions.forEach(decision => {
            decisionsMap.set(decision.suggestionId, decision);
            console.log(`📋 Decisão registrada: ${decision.suggestionId} - Aceito: ${decision.accepted}, Restaurantes: ${decision.selectedRestaurantIds?.length || 'todos'}`);
        });

        // Distribuir restaurantes nos slots
        // ESTRATÉGIA: Coletar TODOS os restaurantes próximos de TODOS os clientes fixos,
        // depois distribuir equilibradamente entre os dias que têm clientes fixos
        console.log(`\n🔄 Iniciando distribuição de restaurantes...`);
        console.log(`📆 Total de dias da semana: ${weekDays.length}`);
        console.log(`📊 Decisões do usuário: ${userDecisions.length}`);
        console.log(`📋 Mapa de decisões criado com ${decisionsMap.size} entradas`);
        
        // Estrutura para armazenar restaurantes próximos (SEM associar a um dia específico)
        interface RestaurantCandidate {
            restaurant: any;
            fixedClientId: string;
            fixedClientName: string;
            fixedClientDay: string; // Dia do cliente fixo (apenas para referência)
            fixedClientDate: string; // Data do cliente fixo (apenas para referência)
            distance: number;
            durationMinutes?: number;
        }
        
        // Identificar quais dias têm clientes fixos
        const daysWithFixedClients = new Set<string>();
        Object.keys(fixedClientsByDay).forEach(date => {
            if (fixedClientsByDay[date] && fixedClientsByDay[date].length > 0) {
                daysWithFixedClients.add(date);
            }
        });
        
        console.log(`📌 Dias com clientes fixos: ${Array.from(daysWithFixedClients).join(', ')}`);
        
        // FASE 1: Coletar TODOS os restaurantes próximos de TODOS os clientes fixos
        console.log(`\n📋 FASE 1: Coletando restaurantes próximos de todos os clientes fixos...`);
        const allRestaurantCandidates: RestaurantCandidate[] = [];
        const globalUsedRestaurantIds = new Set<string>(); // Evitar duplicatas globais
        
        for (const day of weekDays) {
            const fixedClientsToday = fixedClientsByDay[day.date] || [];
            
            console.log(`\n🔍 ${day.day} (${day.date}): ${fixedClientsToday.length} cliente(s) fixo(s)`);
            
            if (fixedClientsToday.length > 0) {
                // Para cada cliente fixo, buscar clientes próximos
                for (const fixedClient of fixedClientsToday) {
                    console.log(`   📍 Cliente fixo: ${fixedClient.restaurantName}`);
                    
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
                        MAX_VISITS_PER_DAY - 1 // Máximo de clientes próximos (6 slots - 1 cliente fixo = 5)
                    );
                    
                    console.log(`      Encontrados: ${nearbyClients.length} restaurantes próximos`);
                    
                    if (nearbyClients.length === 0) {
                        console.log(`      ⚠️ NENHUM restaurante encontrado no raio de ${fixedClient.radiusKm}km!`);
                        continue;
                    }
                    
                    // Filtrar apenas os que não são o próprio cliente fixo e não foram usados ainda
                    let availableNearbyClients = nearbyClients.filter(client => 
                        client.id !== fixedClient.restaurantId &&
                        !globalUsedRestaurantIds.has(client.id)
                    );
                    
                    // Verificar se há ALTISSIMO
                    const hasAltissimo = availableNearbyClients.some(
                        r => r.salesPotential?.toUpperCase() === 'ALTISSIMO'
                    );
                    
                    // Se não há ALTISSIMO, verificar decisão do usuário
                    if (!hasAltissimo && availableNearbyClients.length > 0) {
                        const suggestionId = `suggestion-${day.date}-${fixedClient.id}`;
                        const userDecision = decisionsMap.get(suggestionId);
                        
                        if (userDecision) {
                            if (!userDecision.accepted) {
                                console.log(`      ⏭️ Usuário rejeitou restaurantes de baixo potencial`);
                                availableNearbyClients = [];
                            } else if (userDecision.selectedRestaurantIds && userDecision.selectedRestaurantIds.length > 0) {
                                console.log(`      ✅ Usuário selecionou ${userDecision.selectedRestaurantIds.length} restaurante(s)`);
                                availableNearbyClients = availableNearbyClients.filter(client =>
                                    userDecision.selectedRestaurantIds!.includes(client.id)
                                );
                            } else if (userDecision.accepted) {
                                console.log(`      ✅ Usuário aceitou todos os restaurantes disponíveis`);
                            }
                        } else {
                            console.log(`      ⚠️ Sem decisão do usuário - não agendando`);
                            availableNearbyClients = [];
                        }
                    }
                    
                    // Adicionar restaurantes à lista global (SEM associar a um dia específico)
                    availableNearbyClients.forEach(client => {
                        allRestaurantCandidates.push({
                            restaurant: client,
                            fixedClientId: fixedClient.id,
                            fixedClientName: fixedClient.restaurantName,
                            fixedClientDay: day.day,
                            fixedClientDate: day.date,
                            distance: client.distanceFromFixed || client.distance || 0,
                            durationMinutes: client.durationMinutes
                        });
                        globalUsedRestaurantIds.add(client.id);
                    });
                    
                    console.log(`      ✅ ${availableNearbyClients.length} restaurante(s) adicionado(s) para distribuição`);
                }
            }
        }
        
        console.log(`\n📊 Total de restaurantes coletados para distribuição: ${allRestaurantCandidates.length}`);
        
        // ==========================================================
        // 🧲 NOVA LÓGICA: GRAVIDADE GEOGRÁFICA (CENTROIDS)
        // ==========================================================
        console.log(`\n🧲 FASE 2: Calculando centros de gravidade (centroids) de cada dia...`);
        
        // Calcular centro de gravidade de cada dia baseado nos clientes fixos
        interface DayWithGravity {
            day: string;
            date: string;
            slots: any[];
            center: { lat: number; lng: number } | null; // Centro de gravidade do dia
            bucket: Array<{ restaurant: any; distToCenter: number; score: number }>; // Restaurantes atraídos para este dia
        }
        
        const daysWithGravity: DayWithGravity[] = weekDays.map(day => {
            const fixedClientsToday = fixedClientsByDay[day.date] || [];
            
            // Calcular centro de gravidade (média das coordenadas dos clientes fixos)
            let sumLat = 0, sumLng = 0, countGPS = 0;
            
            fixedClientsToday.forEach(fc => {
                if (fc.latitude && fc.longitude) {
                    sumLat += Number(fc.latitude);
                    sumLng += Number(fc.longitude);
                    countGPS++;
                }
            });
            
            const center = countGPS > 0 ? { lat: sumLat / countGPS, lng: sumLng / countGPS } : null;
            
            if (center) {
                console.log(`   📍 ${day.day} (${day.date}): Centro em (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}) - ${countGPS} cliente(s) fixo(s)`);
            } else {
                console.log(`   ⚠️ ${day.day} (${day.date}): Sem centro (nenhum cliente fixo com GPS)`);
            }
            
            return {
                day: day.day,
                date: day.date,
                slots: day.slots,
                center,
                bucket: []
            };
        });
        
        // ==========================================================
        // FASE 2.1: ATRAIR TODOS OS RESTAURANTES PARA O DIA MAIS PRÓXIMO (GRAVIDADE)
        // ==========================================================
        console.log(`\n🧲 FASE 2.1: Atraindo TODOS os restaurantes para o dia mais próximo (gravidade geográfica)...`);
        
        // Lista para restaurantes que não foram atraídos (para repescagem na FASE 3)
        const notAttractedRestaurants: Array<{ restaurant: any; score: number; lat?: number; lng?: number; bestDay?: string; minDistance?: number }> = [];
        
        // Coletar TODOS os restaurantes da carteira que não foram usados
        const allAvailableRestaurants: Array<{ restaurant: any; score: number; preferredDate?: string }> = [];
        
        // 1. PRIMEIRO: Processar restaurantes coletados na FASE 1 (já têm dia preferido)
        console.log(`   🎯 FASE 2.1.1: Processando ${allRestaurantCandidates.length} restaurante(s) coletados na FASE 1...`);
        for (const candidate of allRestaurantCandidates) {
            if (!usedRestaurantIds.has(candidate.restaurant.id)) {
                const score = scoredRestaurants.find(sr => sr.restaurant.id === candidate.restaurant.id)?.score || 50;
                
                // Encontrar o dia correspondente ao fixedClientDate
                const targetDay = daysWithGravity.find(d => d.date === candidate.fixedClientDate);
                if (targetDay) {
                    // Buscar coordenadas do restaurante
                    const lat = candidate.restaurant.latitude || candidate.restaurant.lat || 0;
                    const lng = candidate.restaurant.longitude || candidate.restaurant.lng || 0;
                    
                    if (lat !== 0 && lng !== 0 && targetDay.center) {
                        // Calcular distância ao centro do dia
                        const dist = calculateDistance(targetDay.center.lat, targetDay.center.lng, lat, lng);
                        targetDay.bucket.push({
                            restaurant: candidate.restaurant,
                            distToCenter: dist,
                            score
                        });
                        usedRestaurantIds.add(candidate.restaurant.id);
                        console.log(`      ✅ ${candidate.restaurant.name} → ${targetDay.day} (${dist.toFixed(1)}km do centro)`);
                    } else {
                        // Sem GPS ou sem centro, adicionar à lista geral
                        allAvailableRestaurants.push({
                            restaurant: candidate.restaurant,
                            score,
                            preferredDate: candidate.fixedClientDate
                        });
                    }
                } else {
                    // Dia não encontrado, adicionar à lista geral
                    allAvailableRestaurants.push({
                        restaurant: candidate.restaurant,
                        score,
                        preferredDate: candidate.fixedClientDate
                    });
                }
            }
        }
        
        // 2. Adicionar TODOS os outros restaurantes da carteira que não foram usados
        for (const sr of scoredRestaurants) {
            if (!usedRestaurantIds.has(sr.restaurant.id)) {
                // Verificar se já não foi adicionado
                if (!allAvailableRestaurants.find(ar => ar.restaurant.id === sr.restaurant.id)) {
                    allAvailableRestaurants.push({
                        restaurant: sr.restaurant,
                        score: sr.score
                    });
                }
            }
        }
        
        console.log(`   📊 Total de restaurantes restantes para atrair: ${allAvailableRestaurants.length}`);
        
        // Buscar coordenadas de todos os restaurantes do banco se necessário
        const restaurantCoordsMap = new Map<string, { lat: number; lng: number }>();
        const restaurantIdsToFetch = new Set<string>();
        
        for (const item of allAvailableRestaurants) {
            const restaurant = item.restaurant;
            const lat = restaurant.latitude || restaurant.lat || 0;
            const lng = restaurant.longitude || restaurant.lng || 0;
            if (lat === 0 || lng === 0) {
                restaurantIdsToFetch.add(restaurant.id);
            } else {
                restaurantCoordsMap.set(restaurant.id, { lat, lng });
            }
        }
        
        // Buscar coordenadas do banco se necessário
        if (restaurantIdsToFetch.size > 0) {
            try {
                console.log(`   🔍 Buscando coordenadas de ${restaurantIdsToFetch.size} restaurante(s) no banco...`);
                const restaurantsFromDb = await prisma.restaurant.findMany({
                    where: { id: { in: Array.from(restaurantIdsToFetch) } },
                    select: { id: true, latitude: true, longitude: true }
                });
                
                restaurantsFromDb.forEach(r => {
                    if (r.latitude && r.longitude) {
                        restaurantCoordsMap.set(r.id, { 
                            lat: Number(r.latitude), 
                            lng: Number(r.longitude) 
                        });
                    }
                });
                console.log(`   ✅ ${restaurantsFromDb.length} coordenada(s) encontrada(s)`);
            } catch (error) {
                console.warn('   ⚠️ Erro ao buscar coordenadas do banco:', error);
            }
        }
        
        // Processar TODOS os restaurantes e atrair para o dia mais próximo
        let attractedCount = 0;
        let skippedNoGPS = 0;
        let skippedTooFar = 0;
        
        for (const item of allAvailableRestaurants) {
            const restaurant = item.restaurant;
            const coords = restaurantCoordsMap.get(restaurant.id);
            
            if (!coords) {
                skippedNoGPS++;
                // Adicionar à lista de repescagem mesmo sem GPS
                notAttractedRestaurants.push({
                    restaurant,
                    score: item.score
                });
                continue;
            }
            
            const { lat, lng } = coords;
            
            // Se o restaurante tem um dia preferido (da FASE 1), SEMPRE priorizar esse dia
            if (item.preferredDate) {
                const preferredDay = daysWithGravity.find(d => d.date === item.preferredDate);
                if (preferredDay) {
                    // Calcular distância se tiver centro, senão usar 0
                    let dist = 0;
                    if (preferredDay.center) {
                        dist = calculateDistance(preferredDay.center.lat, preferredDay.center.lng, lat, lng);
                    }
                    preferredDay.bucket.push({
                        restaurant,
                        distToCenter: dist,
                        score: item.score
                    });
                    usedRestaurantIds.add(restaurant.id);
                    attractedCount++;
                    console.log(`      ✅ ${restaurant.name} → ${preferredDay.day} (preferido da FASE 1, ${dist > 0 ? dist.toFixed(1) + 'km' : 'sem centro'})`);
                    continue;
                } else {
                    console.warn(`      ⚠️ Dia preferido ${item.preferredDate} não encontrado para ${restaurant.name}`);
                }
            }
            
            // Caso contrário, encontrar o dia com centro mais próximo
            let bestDayIdx = -1;
            let minDistance = Infinity;
            
            // Excluir dias que já têm clientes fixos (eles já receberam seus restaurantes na FASE 2.1.1)
            // MAS apenas se o restaurante NÃO tiver preferredDate (já processado acima)
            for (let i = 0; i < daysWithGravity.length; i++) {
                const day = daysWithGravity[i];
                // Se o dia tem cliente fixo, não adicionar mais restaurantes aqui (já foram adicionados na FASE 2.1.1)
                // EXCETO se o restaurante tiver preferredDate para esse dia (já processado acima)
                if (daysWithFixedClients.has(day.date)) {
                    continue;
                }
                
                if (day.center) {
                    const dist = calculateDistance(day.center.lat, day.center.lng, lat, lng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestDayIdx = i;
                    }
                }
            }
            
            // Se encontrou um dia próximo (dentro do raio de gravidade), adicionar ao balde
            if (bestDayIdx !== -1 && minDistance < GRAVITY_MAX_DISTANCE_KM) {
                daysWithGravity[bestDayIdx].bucket.push({
                    restaurant,
                    distToCenter: minDistance,
                    score: item.score
                });
                usedRestaurantIds.add(restaurant.id);
                attractedCount++;
            } else {
                skippedTooFar++;
                // Adicionar à lista de repescagem mesmo que esteja longe
                notAttractedRestaurants.push({
                    restaurant,
                    score: item.score,
                    lat,
                    lng,
                    bestDay: bestDayIdx !== -1 ? daysWithGravity[bestDayIdx].date : undefined,
                    minDistance: bestDayIdx !== -1 ? minDistance : undefined
                });
            }
        }
        
        console.log(`   ✅ ${attractedCount} restaurante(s) atraído(s) para os baldes`);
        console.log(`   ⚠️ ${skippedNoGPS} sem GPS, ${skippedTooFar} fora do raio de ${GRAVITY_MAX_DISTANCE_KM}km`);
        console.log(`   📋 ${notAttractedRestaurants.length} restaurante(s) serão processados na repescagem`);
        
        // ==========================================================
        // FASE 2.2: ORDENAR BALDES E DISTRIBUIR EQUILIBRADAMENTE (ROUND-ROBIN)
        // ==========================================================
        console.log(`\n🔄 FASE 2.2: Ordenando baldes e distribuindo equilibradamente entre os dias...`);
        
        // Primeiro, ordenar cada balde: primeiro por distância ao centro, depois por score
        let totalInBuckets = 0;
        for (const day of daysWithGravity) {
            day.bucket.sort((a, b) => {
                const distDiff = a.distToCenter - b.distToCenter;
                // Se a diferença de distância for pequena (< 2km), desempata pelo score
                if (Math.abs(distDiff) < 2) return b.score - a.score;
                return distDiff;
            });
            
            totalInBuckets += day.bucket.length;
            console.log(`   📦 ${day.day} (${day.date}): ${day.bucket.length} restaurante(s) no balde`);
        }
        
        console.log(`   📊 Total de restaurantes nos baldes: ${totalInBuckets}`);
        
        // Distribuir equilibradamente usando round-robin entre os dias que têm restaurantes no balde
        let daysWithBuckets = daysWithGravity.filter(d => d.bucket.length > 0 && d.slots.some((s: any) => !s.restaurantId));
        let roundRobinBucketIndex = 0;
        let totalDistributed = 0;
        let maxIterations = totalInBuckets * 2; // Limite de segurança para evitar loop infinito
        let iterations = 0;
        
        console.log(`\n🔄 Distribuindo restaurantes entre ${daysWithBuckets.length} dias usando round-robin...`);
        
        while (daysWithBuckets.length > 0 && iterations < maxIterations) {
            iterations++;
            
            // Ajustar índice se necessário
            if (roundRobinBucketIndex >= daysWithBuckets.length) {
                roundRobinBucketIndex = 0;
            }
            
            const targetDay = daysWithBuckets[roundRobinBucketIndex];
            
            // Verificar se o dia ainda tem espaço
            const currentFilled = targetDay.slots.filter((s: any) => s.restaurantId).length;
            if (currentFilled >= MAX_VISITS_PER_DAY) {
                // Remover dia da lista se atingiu o limite
                daysWithBuckets = daysWithBuckets.filter(d => d.date !== targetDay.date);
                if (daysWithBuckets.length === 0) break;
                roundRobinBucketIndex = 0;
                continue;
            }
            
            // Pegar próximo restaurante do balde deste dia
            if (targetDay.bucket.length === 0) {
                // Balde vazio, remover da lista
                daysWithBuckets = daysWithBuckets.filter(d => d.date !== targetDay.date);
                if (daysWithBuckets.length === 0) break;
                roundRobinBucketIndex = 0;
                continue;
            }
            
            const candidate = targetDay.bucket.shift()!; // Remove do início do array
            const emptySlot = targetDay.slots.find((s: any) => !s.restaurantId);
            
            if (emptySlot) {
                emptySlot.restaurantId = candidate.restaurant.id;
                emptySlot.restaurantName = candidate.restaurant.name;
                
                // Adicionar informações de distância
                (emptySlot as any).distanceFromFixed = candidate.distToCenter;
                (emptySlot as any).details = `📏 ~${candidate.distToCenter.toFixed(1)}km do centro`;
                
                const newFilled = currentFilled + 1;
                totalDistributed++;
                console.log(`   ✅ ${targetDay.day} (${targetDay.date}): ${candidate.restaurant.name} (${newFilled}/${MAX_VISITS_PER_DAY}) - ${candidate.distToCenter.toFixed(1)}km`);
                
                // Se este dia atingiu o limite, remover da lista
                if (newFilled >= MAX_VISITS_PER_DAY) {
                    daysWithBuckets = daysWithBuckets.filter(d => d.date !== targetDay.date);
                    if (daysWithBuckets.length === 0) break;
                    roundRobinBucketIndex = 0;
                } else {
                    // Avançar para próximo dia (round-robin)
                    roundRobinBucketIndex++;
                }
            } else {
                // Dia não tem mais slots vazios, remover da lista
                daysWithBuckets = daysWithBuckets.filter(d => d.date !== targetDay.date);
                if (daysWithBuckets.length === 0) break;
                roundRobinBucketIndex = 0;
            }
        }
        
        if (iterations >= maxIterations) {
            console.warn(`   ⚠️ Limite de iterações atingido (${maxIterations})`);
        }
        
        console.log(`   ✅ Total distribuído: ${totalDistributed} restaurante(s)`);
        
        // Coletar restaurantes que sobraram nos baldes para repescagem
        const remainingInBuckets: Array<{ restaurant: any; score: number; preferredDay: string; distToCenter: number }> = [];
        for (const day of daysWithGravity) {
            if (day.bucket.length > 0) {
                console.log(`   ⚠️ ${day.day}: ${day.bucket.length} restaurante(s) não couberam, indo para repescagem`);
                day.bucket.forEach(candidate => {
                    remainingInBuckets.push({
                        restaurant: candidate.restaurant,
                        score: candidate.score,
                        preferredDay: day.date,
                        distToCenter: candidate.distToCenter
                    });
                });
                day.bucket = []; // Limpar balde
            }
        }
        
        // ==========================================================
        // FASE 3: REPESCAGEM INTELIGENTE (Restaurantes que não couberam ou sem GPS)
        // ==========================================================
        console.log(`\n📊 FASE 3: Repescagem inteligente de restaurantes restantes...`);
        
        // FASE 3.1: Tentar realocar restaurantes que sobraram dos baldes para outros dias próximos
        if (remainingInBuckets.length > 0) {
            console.log(`\n🔄 FASE 3.1: Tentando realocar ${remainingInBuckets.length} restaurante(s) que não couberam no dia preferido...`);
            
            for (const item of remainingInBuckets) {
                if (usedRestaurantIds.has(item.restaurant.id)) continue;
                
                // Buscar coordenadas se necessário
                let lat = item.restaurant.latitude || item.restaurant.lat || 0;
                let lng = item.restaurant.longitude || item.restaurant.lng || 0;
                
                if (lat === 0 || lng === 0) {
                    // Tentar buscar do banco
                    try {
                        const rFromDb = await prisma.restaurant.findUnique({
                            where: { id: item.restaurant.id },
                            select: { latitude: true, longitude: true }
                        });
                        if (rFromDb?.latitude && rFromDb?.longitude) {
                            lat = Number(rFromDb.latitude);
                            lng = Number(rFromDb.longitude);
                        }
                    } catch (e) {
                        // Ignorar erro
                    }
                }
                
                // Se tem GPS, tentar encontrar outro dia próximo
                if (lat !== 0 && lng !== 0) {
                    // Encontrar dias com vagas, ordenados por proximidade ao restaurante
                    const daysWithSlots = daysWithGravity
                        .filter(d => d.slots.some((s: any) => !s.restaurantId))
                        .map(day => {
                            if (day.center) {
                                const dist = calculateDistance(day.center.lat, day.center.lng, lat, lng);
                                return { day, dist };
                            }
                            return { day, dist: Infinity };
                        })
                        .sort((a, b) => a.dist - b.dist);
                    
                    // Tentar o dia mais próximo que tenha vaga
                    for (const { day } of daysWithSlots) {
                        const emptySlot = day.slots.find((s: any) => !s.restaurantId);
                        if (emptySlot) {
                            emptySlot.restaurantId = item.restaurant.id;
                            emptySlot.restaurantName = item.restaurant.name;
                            (emptySlot as any).details = `Encaixe (${day.day} cheio)`;
                            usedRestaurantIds.add(item.restaurant.id);
                            
                            const filled = day.slots.filter((s: any) => s.restaurantId).length;
                            console.log(`   ✅ ${day.day}: ${item.restaurant.name} (${filled}/${MAX_VISITS_PER_DAY}) - realocado`);
                            break;
                        }
                    }
                }
            }
        }
        
        // FASE 3.2: Processar restaurantes sem GPS ou que não foram atraídos
        console.log(`\n🔄 FASE 3.2: Processando restaurantes sem GPS ou não atraídos...`);
        
        // Usar a lista de restaurantes não atraídos da FASE 2.1
        const remainingRestaurants: Array<{ restaurant: any; score: number; lat?: number; lng?: number; bestDay?: string; minDistance?: number }> = [...notAttractedRestaurants];
        
        // Adicionar também qualquer restaurante que ainda não foi usado (caso tenha sido perdido)
        const remainingIdsToFetch = new Set<string>();
        for (const sr of scoredRestaurants) {
            if (usedRestaurantIds.has(sr.restaurant.id)) continue;
            
            // Verificar se já está na lista
            if (remainingRestaurants.find(r => r.restaurant.id === sr.restaurant.id)) continue;
            
            const lat = (sr.restaurant as any).latitude || (sr.restaurant as any).lat || 0;
            const lng = (sr.restaurant as any).longitude || (sr.restaurant as any).lng || 0;
            
            if (lat === 0 || lng === 0) {
                remainingIdsToFetch.add(sr.restaurant.id);
            }
            
            remainingRestaurants.push({
                restaurant: sr.restaurant,
                score: sr.score,
                lat: lat !== 0 ? lat : undefined,
                lng: lng !== 0 ? lng : undefined
            });
        }
        
        // Buscar coordenadas do banco para os que faltam
        if (remainingIdsToFetch.size > 0) {
            try {
                const restaurantsFromDb = await prisma.restaurant.findMany({
                    where: { id: { in: Array.from(remainingIdsToFetch) } },
                    select: { id: true, latitude: true, longitude: true }
                });
                
                restaurantsFromDb.forEach(r => {
                    const item = remainingRestaurants.find(rem => rem.restaurant.id === r.id);
                    if (item && r.latitude && r.longitude) {
                        item.lat = Number(r.latitude);
                        item.lng = Number(r.longitude);
                    }
                });
            } catch (error) {
                console.warn('   ⚠️ Erro ao buscar coordenadas do banco (repescagem):', error);
            }
        }
        
        // Ordenar: primeiro por distância (se tiver), depois por score
        remainingRestaurants.sort((a, b) => {
            // Se ambos têm distância, priorizar o mais próximo
            if (a.minDistance !== undefined && b.minDistance !== undefined) {
                return a.minDistance - b.minDistance;
            }
            // Se só um tem distância, priorizar o que tem
            if (a.minDistance !== undefined) return -1;
            if (b.minDistance !== undefined) return 1;
            // Se nenhum tem distância, ordenar por score
            return b.score - a.score;
        });
        
        console.log(`   📝 ${remainingRestaurants.length} restaurante(s) disponível(is) para repescagem final`);
        
        // Preencher slots vazios restantes
        // Se o restaurante tem GPS e um dia preferido, tentar esse dia primeiro
        // Caso contrário, usar round-robin
        let roundRobinIndex = 0;
        let daysWithSlots = daysWithGravity.filter(d => d.slots.some((s: any) => !s.restaurantId));
        
        for (const item of remainingRestaurants) {
            if (daysWithSlots.length === 0) break;
            if (usedRestaurantIds.has(item.restaurant.id)) continue;
            
            let targetDay: typeof daysWithGravity[0] | undefined;
            
            // Se tem GPS e um dia preferido, tentar esse dia primeiro
            if (item.lat && item.lng && item.bestDay) {
                const preferredDay = daysWithGravity.find(d => d.date === item.bestDay);
                if (preferredDay && preferredDay.slots.some((s: any) => !s.restaurantId)) {
                    targetDay = preferredDay;
                }
            }
            
            // Se não encontrou dia preferido ou não tem GPS, usar round-robin
            if (!targetDay) {
                roundRobinIndex = roundRobinIndex % daysWithSlots.length;
                targetDay = daysWithSlots[roundRobinIndex];
            }
            
            const emptySlot = targetDay.slots.find((s: any) => !s.restaurantId);
            if (emptySlot) {
                emptySlot.restaurantId = item.restaurant.id;
                emptySlot.restaurantName = item.restaurant.name;
                
                // Detalhes mais informativos
                if (item.lat && item.lng) {
                    if (item.minDistance !== undefined) {
                        (emptySlot as any).details = `Encaixe (~${item.minDistance.toFixed(1)}km)`;
                    } else {
                        (emptySlot as any).details = 'Encaixe (Sem centro próximo)';
                    }
                } else {
                    (emptySlot as any).details = 'Sem GPS';
                }
                
                usedRestaurantIds.add(item.restaurant.id);
                
                const filled = targetDay.slots.filter((s: any) => s.restaurantId).length;
                console.log(`   ✅ ${targetDay.day}: ${item.restaurant.name} (${filled}/${MAX_VISITS_PER_DAY})`);
                
                if (filled >= MAX_VISITS_PER_DAY) {
                    daysWithSlots = daysWithSlots.filter(d => d.date !== targetDay.date);
                    if (daysWithSlots.length === 0) break;
                    roundRobinIndex = 0;
                } else {
                    roundRobinIndex++;
                }
            } else {
                daysWithSlots = daysWithSlots.filter(d => d.date !== targetDay.date);
                if (daysWithSlots.length === 0) break;
                roundRobinIndex = 0;
            }
        }
        
        // Atualizar weekDays com os slots preenchidos
        weekDays.forEach((day, idx) => {
            day.slots = daysWithGravity[idx].slots;
        });
        
        // Log de resumo por dia
        console.log(`\n📊 Resumo da distribuição:`);
        weekDays.forEach(day => {
            const filled = day.slots.filter(s => s.restaurantId).length;
            console.log(`   ${day.day} (${day.date}): ${filled}/${MAX_VISITS_PER_DAY} preenchidos`);
        });
        
        console.log('\n✨ Preenchimento com lógica de gravidade geográfica concluído!\n');
        
        // Log final detalhado sobre distribuição
        console.log('\n📊 RESUMO FINAL DA DISTRIBUIÇÃO:');
        console.log('================================');
        for (const day of weekDays) {
            const filled = day.slots.filter(s => s.restaurantId).length;
            const empty = day.slots.filter(s => !s.restaurantId).length;
            const hasFixed = daysWithFixedClients.has(day.date);
            const status = filled >= MAX_VISITS_PER_DAY ? '✅ CHEIO' : filled > 0 ? '🟡 PARCIAL' : '⚪ VAZIO';
            console.log(`   ${day.day} (${day.date}): ${filled}/${MAX_VISITS_PER_DAY} preenchidos | ${empty} vazios | ${hasFixed ? '📌 Tem cliente fixo' : '📋 Sem cliente fixo'} | ${status}`);
            
            if (filled > 0) {
                const restaurants = day.slots
                    .filter(s => s.restaurantId)
                    .map(s => s.restaurantName)
                    .join(', ');
                console.log(`      Restaurantes: ${restaurants}`);
            }
        }
        
        const totalScheduled = weekDays.reduce((sum, day) => sum + day.slots.filter(s => s.restaurantId).length, 0);
        const totalSlots = weekDays.length * MAX_VISITS_PER_DAY;
        const utilizationPercent = ((totalScheduled / totalSlots) * 100).toFixed(1);
        
        console.log(`\n✅ Agenda gerada:`);
        console.log(`   Total de restaurantes agendados: ${totalScheduled}`);
        console.log(`   Total de slots disponíveis: ${totalSlots}`);
        console.log(`   Taxa de utilização: ${utilizationPercent}%`);
        console.log('================================\n');
        
        return weekDays;
    } catch (error) {
        console.error('❌ Erro ao gerar agenda inteligente:', error);
        throw error; // Propagar erro para tratamento adequado
    }
}

// Analisar preenchimento inteligente e retornar sugestões que precisam de confirmação
export async function analyzeIntelligentFill(
    restaurants: Restaurant[],
    sellerId: string,
    weekStart: Date,
    existingSchedule: any[] = []
): Promise<FillSuggestion[]> {
        try {
            console.log('🔍 Iniciando análise de preenchimento inteligente...');
            console.log(`📊 Total de restaurantes: ${restaurants.length}`);
            console.log(`📅 Semana iniciando em: ${weekStart.toISOString().split('T')[0]}`);
            
            const suggestions: FillSuggestion[] = [];
            let suggestionIdCounter = 0;

            // Buscar clientes fixos da semana
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
            console.log(`📌 Clientes fixos encontrados para a semana:`, Object.keys(fixedClientsByDay).length, 'dias');
        } catch (error) {
            console.warn('Erro ao buscar clientes fixos:', error);
            fixedClientsByDay = {};
        }

        // Gerar dias da semana (segunda a sexta)
        const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        const weekDays: Array<{ day: string; date: string }> = [];
        
        for (let i = 0; i < 5; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            weekDays.push({
                day: daysOfWeek[i],
                date: dateString
            });
        }

        // Analisar cada dia da semana
        console.log(`\n📅 Analisando ${weekDays.length} dias da semana...`);
        for (const day of weekDays) {
            const fixedClientsToday = fixedClientsByDay[day.date] || [];
            
            console.log(`\n🔍 ${day.day} (${day.date}): ${fixedClientsToday.length} cliente(s) fixo(s)`);
            
            if (fixedClientsToday.length > 0) {
                // Para cada cliente fixo do dia
                for (const fixedClient of fixedClientsToday) {
                    console.log(`\n🔍 Analisando ${day.day} (${day.date}) - Cliente fixo: ${fixedClient.restaurantName}`);
                    
                    // Buscar restaurantes próximos
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
                        MAX_VISITS_PER_DAY - 1 // Máximo de clientes próximos (6 slots - 1 cliente fixo = 5)
                    );

                    // Filtrar apenas os que não são o próprio cliente fixo
                    const availableNearbyClients = nearbyClients.filter(client => 
                        client.id !== fixedClient.restaurantId
                    );

                    if (availableNearbyClients.length === 0) {
                        // Nenhum restaurante próximo encontrado
                        suggestionIdCounter++;
                        // Usar ID baseado em dia e cliente fixo para matching correto
                        const suggestionId = `suggestion-${day.date}-${fixedClient.id}`;
                        suggestions.push({
                            id: suggestionId,
                            type: 'NO_NEARBY',
                            day: day.date,
                            dayName: day.day,
                            fixedClient: {
                                id: fixedClient.id,
                                name: fixedClient.restaurantName,
                                address: fixedClient.restaurantAddress,
                                radiusKm: fixedClient.radiusKm
                            },
                            restaurants: [],
                            message: `Não há restaurantes disponíveis para prospecção próximos ao cliente fixo "${fixedClient.restaurantName}" em ${day.day} (raio de ${fixedClient.radiusKm}km).`,
                            details: `Este slot permanecerá vazio, pois não há restaurantes na carteira dentro do raio de ${fixedClient.radiusKm}km do cliente fixo.`
                        });
                    } else {
                        // Verificar se há restaurantes ALTISSIMO
                        const hasAltissimo = availableNearbyClients.some(
                            r => r.salesPotential?.toUpperCase() === 'ALTISSIMO'
                        );

                        if (!hasAltissimo) {
                            // Todos os restaurantes próximos são de potencial médio/baixo
                            suggestionIdCounter++;
                            // Usar ID baseado em dia e cliente fixo para matching correto
                            const suggestionId = `suggestion-${day.date}-${fixedClient.id}`;
                            suggestions.push({
                                id: suggestionId,
                                type: 'LOW_POTENTIAL',
                                day: day.date,
                                dayName: day.day,
                                fixedClient: {
                                    id: fixedClient.id,
                                    name: fixedClient.restaurantName,
                                    address: fixedClient.restaurantAddress,
                                    radiusKm: fixedClient.radiusKm
                                },
                                restaurants: availableNearbyClients.map(r => ({
                                    id: r.id,
                                    name: r.name,
                                    distance: r.distanceFromFixed || r.distance || 0,
                                    durationMinutes: r.durationMinutes,
                                    potential: r.salesPotential || 'BAIXO',
                                    status: r.status || 'Novo',
                                    address: r.address
                                })),
                                message: `Encontramos ${availableNearbyClients.length} restaurante(s) próximo(s) ao cliente fixo "${fixedClient.restaurantName}" em ${day.day}, mas nenhum tem potencial ALTISSIMO. Deseja agendar mesmo assim?`,
                                details: `Os restaurantes encontrados estão dentro do raio de ${fixedClient.radiusKm}km, mas têm potencial médio ou baixo. Você pode selecionar quais deseja agendar.`
                            });
                        }
                        // Se tem ALTISSIMO, não precisa de confirmação - será agendado automaticamente
                    }
                }
            }
        }

        console.log(`\n✅ Análise concluída: ${suggestions.length} sugestão(ões) que precisam de confirmação`);
        return suggestions;
    } catch (error) {
        console.error('❌ Erro ao analisar preenchimento inteligente:', error);
        return [];
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

