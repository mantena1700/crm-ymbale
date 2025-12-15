'use server';

import { prisma } from '@/lib/db';
import { getFixedClientsForWeek, findNearbyProspectClients } from './actions';
import type { FillSuggestion } from './ConfirmationModal';

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

        // Criar mapa de decisões do usuário por sugestão ID
        const decisionsMap = new Map<string, UserDecision>();
        userDecisions.forEach(decision => {
            decisionsMap.set(decision.suggestionId, decision);
            console.log(`📋 Decisão registrada: ${decision.suggestionId} - Aceito: ${decision.accepted}, Restaurantes: ${decision.selectedRestaurantIds?.length || 'todos'}`);
        });

        // Distribuir restaurantes nos slots
        // Primeiro: preencher dias com clientes fixos usando clientes próximos
        console.log(`\n🔄 Iniciando distribuição de restaurantes...`);
        console.log(`📆 Total de dias da semana: ${weekDays.length}`);
        console.log(`📊 Decisões do usuário: ${userDecisions.length}`);
        console.log(`📋 Mapa de decisões criado com ${decisionsMap.size} entradas`);
        
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
                    let availableNearbyClients = nearbyClients.filter(client => 
                        client.id !== fixedClient.restaurantId &&
                        !usedInThisDay.has(client.id)
                    );
                    
                    // Verificar se há ALTISSIMO
                    const hasAltissimo = availableNearbyClients.some(
                        r => r.salesPotential?.toUpperCase() === 'ALTISSIMO'
                    );
                    
                    // Se não há ALTISSIMO, verificar decisão do usuário
                    if (!hasAltissimo && availableNearbyClients.length > 0) {
                        // Buscar decisão do usuário para este dia/cliente fixo
                        // Criar ID da sugestão baseado no dia e cliente fixo
                        const suggestionId = `suggestion-${day.date}-${fixedClient.id}`;
                        const userDecision = decisionsMap.get(suggestionId);
                        
                        if (userDecision) {
                            if (!userDecision.accepted) {
                                // Usuário rejeitou, pular estes restaurantes
                                console.log(`      ⏭️ Usuário rejeitou restaurantes de baixo potencial para este dia`);
                                availableNearbyClients = [];
                            } else if (userDecision.selectedRestaurantIds && userDecision.selectedRestaurantIds.length > 0) {
                                // Usuário aceitou apenas alguns restaurantes selecionados
                                console.log(`      ✅ Usuário selecionou ${userDecision.selectedRestaurantIds.length} restaurante(s) para este dia`);
                                availableNearbyClients = availableNearbyClients.filter(client =>
                                    userDecision.selectedRestaurantIds!.includes(client.id)
                                );
                            } else if (userDecision.accepted) {
                                // Usuário aceitou mas sem seleção específica - aceitar todos os disponíveis
                                console.log(`      ✅ Usuário aceitou todos os restaurantes disponíveis para este dia`);
                                // availableNearbyClients já contém todos, não precisa filtrar
                            }
                        } else {
                            // Sem decisão do usuário - se não é ALTISSIMO, não agendar (será perguntado antes)
                            console.log(`      ⚠️ Sem decisão do usuário para restaurantes de baixo potencial - não agendando`);
                            availableNearbyClients = [];
                        }
                    }
                    
                    console.log(`      Disponíveis após filtro: ${availableNearbyClients.length}`);
                    
                    if (availableNearbyClients.length > 0) {
                        console.log(`      Top 3 restaurantes:`);
                        availableNearbyClients.slice(0, 3).forEach((r, idx) => {
                            const dist = r.distanceFromFixed || r.distance || 'N/A';
                            console.log(`         ${idx + 1}. ${r.name} (${typeof dist === 'number' ? dist.toFixed(2) : dist}km)`);
                        });
                    }
                    
                    // Preencher slots vazios do dia com clientes próximos
                    // IMPORTANTE: Limitar a 8 visitas por dia (ou 6 como padrão)
                    const maxVisitsPerDay = 8;
                    const currentDayFilled = day.slots.filter(s => s.restaurantId).length;
                    const remainingSlots = maxVisitsPerDay - currentDayFilled;
                    
                    let filledCount = 0;
                    const maxToFill = Math.min(availableNearbyClients.length, remainingSlots);
                    
                    console.log(`      📅 Preenchendo slots para ${day.day} (${day.date}):`);
                    console.log(`         Slots já preenchidos: ${currentDayFilled}/${maxVisitsPerDay}`);
                    console.log(`         Restaurantes disponíveis: ${availableNearbyClients.length}`);
                    console.log(`         Máximo a preencher: ${maxToFill}`);
                    
                    for (const slot of day.slots) {
                        if (!slot.restaurantId && filledCount < maxToFill) {
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
                            
                            console.log(`         ✅ Slot ${slot.time}: ${nearbyClient.name} (${filledCount}/${maxToFill})`);
                        }
                    }
                    
                    console.log(`      ✅ Preenchidos: ${filledCount} slots (limite: ${maxVisitsPerDay} por dia, já preenchidos: ${currentDayFilled})`);
                    
                    // Se ainda há restaurantes disponíveis mas o dia está cheio, avisar
                    if (availableNearbyClients.length > maxToFill && filledCount >= maxToFill) {
                        console.log(`      ⚠️ Dia ${day.day} atingiu o limite de ${maxVisitsPerDay} visitas. ${availableNearbyClients.length - maxToFill} restaurante(s) não foram agendados neste dia.`);
                    }
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
        
        // Segundo: preencher APENAS dias SEM clientes fixos com lógica de score
        // IMPORTANTE: NUNCA preencher dias com clientes fixos usando restaurantes que não foram
        // validados como próximos. Se um dia tem cliente fixo mas slots vazios, significa que
        // não há restaurantes próximos suficientes, e isso é OK - não devemos forçar preenchimento.
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
        console.log(`⚠️ IMPORTANTE: Dias com clientes fixos NÃO serão preenchidos com restaurantes distantes`);

        // Preencher APENAS dias SEM clientes fixos
        // IMPORTANTE: Distribuir equilibradamente pelos dias, respeitando limite de 8 por dia
        const maxVisitsPerDay = 8;
        
        for (const scoredRestaurant of availableRestaurants) {
            const restaurant = scoredRestaurant.restaurant;
            
            let found = false;
            
            // Preencher APENAS dias SEM clientes fixos
            // Distribuir de forma equilibrada entre os dias disponíveis
            for (const day of weekDays) {
                // CRÍTICO: Pular dias com clientes fixos - eles já foram preenchidos com lógica de proximidade
                // Se ainda têm slots vazios, é porque não há restaurantes próximos suficientes
                if (daysWithFixedClients.has(day.date)) {
                    continue; // NUNCA preencher dias com clientes fixos com restaurantes não validados
                }
                
                // Verificar se o dia ainda tem espaço (limite de 8 visitas por dia)
                const currentDayFilled = day.slots.filter(s => s.restaurantId).length;
                if (currentDayFilled >= maxVisitsPerDay) {
                    continue; // Dia já atingiu o limite
                }
                
                const emptySlot = day.slots.find(slot => !slot.restaurantId);
                if (emptySlot) {
                    emptySlot.restaurantId = restaurant.id;
                    emptySlot.restaurantName = restaurant.name;
                    usedRestaurantIds.add(restaurant.id);
                    restaurantIndex++;
                    found = true;
                    console.log(`   ✅ Preenchido slot em ${day.day} (sem cliente fixo): ${restaurant.name} (${currentDayFilled + 1}/${maxVisitsPerDay})`);
                    break;
                }
            }
            
            if (!found) {
                // Verificar se ainda há slots disponíveis em algum dia
                const hasAvailableSlots = weekDays.some(day => {
                    if (daysWithFixedClients.has(day.date)) return false;
                    const currentDayFilled = day.slots.filter(s => s.restaurantId).length;
                    return currentDayFilled < maxVisitsPerDay && day.slots.some(s => !s.restaurantId);
                });
                
                if (!hasAvailableSlots) {
                    console.log(`   ⚠️ Todos os dias sem clientes fixos atingiram o limite de ${maxVisitsPerDay} visitas ou não há mais slots disponíveis`);
                    break; // Não há mais slots disponíveis em dias sem clientes fixos
                }
            }
        }
        
        // Log final sobre dias com clientes fixos que ficaram com slots vazios
        for (const day of weekDays) {
            if (daysWithFixedClients.has(day.date)) {
                const emptySlots = day.slots.filter(s => !s.restaurantId).length;
                if (emptySlots > 0) {
                    console.log(`   ℹ️ ${day.day} tem ${emptySlots} slots vazios (sem restaurantes próximos suficientes)`);
                }
            }
        }

        const totalScheduled = weekDays.reduce((sum, day) => sum + day.slots.filter(s => s.restaurantId).length, 0);
        console.log(`✅ Agenda gerada com ${totalScheduled} restaurantes agendados`);
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
                        7
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

