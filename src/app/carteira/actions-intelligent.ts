'use server';

import { prisma } from '@/lib/db';
import { getFixedClientsForWeek, findNearbyProspectClients } from './actions';
import type { FillSuggestion } from './ConfirmationModal';

// Constante para limite de visitas por dia
const MAX_VISITS_PER_DAY = 6;

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
        
        // Ordenar todos os candidatos por distância (mais próximos primeiro)
        allRestaurantCandidates.sort((a, b) => a.distance - b.distance);
        
        // FASE 2: Distribuir restaurantes equilibradamente entre os dias que têm clientes fixos
        console.log(`\n🔄 FASE 2: Distribuindo restaurantes equilibradamente entre os dias...`);
        
        // Criar lista de dias disponíveis para distribuição (apenas dias com clientes fixos)
        const availableDaysForDistribution = weekDays.filter(day => 
            daysWithFixedClients.has(day.date) && 
            day.slots.filter(s => s.restaurantId).length < MAX_VISITS_PER_DAY
        );
        
        console.log(`📆 Dias disponíveis para distribuição: ${availableDaysForDistribution.length}`);
        availableDaysForDistribution.forEach(day => {
            const filled = day.slots.filter(s => s.restaurantId).length;
            console.log(`   ${day.day} (${day.date}): ${filled}/${MAX_VISITS_PER_DAY} preenchidos`);
        });
        
        // Distribuir usando round-robin: distribuir um restaurante por vez para cada dia disponível
        let roundRobinDayIndex = 0;
        const distributedCount = new Map<string, number>(); // Contador por dia
        
        // Inicializar contadores
        weekDays.forEach(day => {
            distributedCount.set(day.date, day.slots.filter(s => s.restaurantId).length);
        });
        
        console.log(`\n🔄 Iniciando distribuição round-robin de ${allRestaurantCandidates.length} restaurantes entre ${availableDaysForDistribution.length} dias...`);
        
        for (const candidate of allRestaurantCandidates) {
            // Se não há mais dias disponíveis, parar
            if (availableDaysForDistribution.length === 0) {
                console.log(`   ⚠️ Todos os dias atingiram o limite de ${MAX_VISITS_PER_DAY} visitas`);
                break;
            }
            
            // Ajustar índice se necessário (caso a lista tenha sido reduzida)
            if (roundRobinDayIndex >= availableDaysForDistribution.length) {
                roundRobinDayIndex = 0;
            }
            
            // Selecionar próximo dia (round-robin)
            const targetDay = availableDaysForDistribution[roundRobinDayIndex];
            
            // Verificar se o dia ainda tem espaço
            const currentFilled = distributedCount.get(targetDay.date) || 0;
            if (currentFilled >= MAX_VISITS_PER_DAY) {
                // Remover dia da lista
                const idx = availableDaysForDistribution.findIndex(d => d.date === targetDay.date);
                if (idx !== -1) {
                    availableDaysForDistribution.splice(idx, 1);
                    // Ajustar índice se removemos um dia antes do índice atual
                    if (idx <= roundRobinDayIndex && roundRobinDayIndex > 0) {
                        roundRobinDayIndex--;
                    } else if (roundRobinDayIndex >= availableDaysForDistribution.length) {
                        roundRobinDayIndex = 0;
                    }
                }
                if (availableDaysForDistribution.length === 0) break;
                continue; // Tentar novamente com o mesmo índice (que agora aponta para o próximo dia)
            }
            
            // Encontrar slot vazio neste dia
            const emptySlot = targetDay.slots.find(slot => !slot.restaurantId);
            if (emptySlot) {
                emptySlot.restaurantId = candidate.restaurant.id;
                emptySlot.restaurantName = candidate.restaurant.name;
                
                // Adicionar distância e tempo
                if (candidate.distance !== undefined) {
                    (emptySlot as any).distanceFromFixed = candidate.distance;
                }
                if (candidate.durationMinutes !== undefined) {
                    (emptySlot as any).durationMinutes = candidate.durationMinutes;
                }
                
                // Atualizar contador
                const newFilled = currentFilled + 1;
                distributedCount.set(targetDay.date, newFilled);
                usedRestaurantIds.add(candidate.restaurant.id);
                
                console.log(`   ✅ ${targetDay.day} (${targetDay.date}): ${candidate.restaurant.name} (${newFilled}/${MAX_VISITS_PER_DAY})`);
                
                // Se este dia atingiu o limite, remover da lista
                if (newFilled >= MAX_VISITS_PER_DAY) {
                    const idx = availableDaysForDistribution.findIndex(d => d.date === targetDay.date);
                    if (idx !== -1) {
                        availableDaysForDistribution.splice(idx, 1);
                        // Ajustar índice se removemos um dia antes do índice atual
                        if (idx < roundRobinDayIndex && roundRobinDayIndex > 0) {
                            roundRobinDayIndex--;
                        } else if (roundRobinDayIndex >= availableDaysForDistribution.length) {
                            roundRobinDayIndex = 0;
                        }
                    }
                } else {
                    // Avançar para próximo dia (round-robin)
                    roundRobinDayIndex = (roundRobinDayIndex + 1) % availableDaysForDistribution.length;
                }
            } else {
                // Dia não tem mais slots vazios, remover da lista
                const idx = availableDaysForDistribution.findIndex(d => d.date === targetDay.date);
                if (idx !== -1) {
                    availableDaysForDistribution.splice(idx, 1);
                    // Ajustar índice se removemos um dia antes do índice atual
                    if (idx < roundRobinDayIndex && roundRobinDayIndex > 0) {
                        roundRobinDayIndex--;
                    } else if (roundRobinDayIndex >= availableDaysForDistribution.length) {
                        roundRobinDayIndex = 0;
                    }
                }
                if (availableDaysForDistribution.length === 0) break;
            }
        }
        
        // Log de resumo por dia
        console.log(`\n📊 Resumo da distribuição:`);
        weekDays.forEach(day => {
            const filled = day.slots.filter(s => s.restaurantId).length;
            console.log(`   ${day.day} (${day.date}): ${filled}/${MAX_VISITS_PER_DAY} preenchidos`);
        });
        
        console.log('\n✨ Preenchimento de dias com clientes fixos concluído!\n');
        
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

        // Preencher dias SEM clientes fixos usando algoritmo round-robin para distribuição equilibrada
        // IMPORTANTE: Distribuir equilibradamente pelos dias, respeitando limite de 6 por dia
        
        // Filtrar dias que ainda têm espaço disponível (incluindo dias com clientes fixos que têm slots vazios)
        const daysToFill = weekDays.filter(day => {
            const currentDayFilled = day.slots.filter(s => s.restaurantId).length;
            return currentDayFilled < MAX_VISITS_PER_DAY && day.slots.some(s => !s.restaurantId);
        });
        
        console.log(`\n🔄 Distribuindo restaurantes usando algoritmo round-robin...`);
        console.log(`📆 Dias disponíveis para preenchimento: ${daysToFill.length}`);
        daysToFill.forEach(day => {
            const filled = day.slots.filter(s => s.restaurantId).length;
            console.log(`   ${day.day} (${day.date}): ${filled}/${MAX_VISITS_PER_DAY} preenchidos`);
        });
        
        // Round-robin: distribuir um restaurante por vez para cada dia disponível
        let roundRobinIndex = 0;
        for (const scoredRestaurant of availableRestaurants) {
            if (daysToFill.length === 0) {
                console.log(`   ⚠️ Todos os dias atingiram o limite de ${MAX_VISITS_PER_DAY} visitas`);
                break;
            }
            
            const restaurant = scoredRestaurant.restaurant;
            
            // Selecionar próximo dia disponível (round-robin)
            const day = daysToFill[roundRobinIndex % daysToFill.length];
            
            // Verificar se o dia ainda tem espaço
            const currentDayFilled = day.slots.filter(s => s.restaurantId).length;
            if (currentDayFilled >= MAX_VISITS_PER_DAY) {
                // Remover dia da lista se atingiu o limite
                const dayIdx = daysToFill.findIndex(d => d.date === day.date);
                if (dayIdx !== -1) {
                    daysToFill.splice(dayIdx, 1);
                }
                if (daysToFill.length === 0) break;
                roundRobinIndex = roundRobinIndex % daysToFill.length; // Ajustar índice
                continue;
            }
            
                const emptySlot = day.slots.find(slot => !slot.restaurantId);
                if (emptySlot) {
                    emptySlot.restaurantId = restaurant.id;
                    emptySlot.restaurantName = restaurant.name;
                usedRestaurantIds.add(restaurant.id);
                    restaurantIndex++;
                console.log(`   ✅ Preenchido slot em ${day.day} (${day.date}): ${restaurant.name} (${currentDayFilled + 1}/${MAX_VISITS_PER_DAY})`);
                
                // Avançar para próximo dia (round-robin)
                roundRobinIndex++;
                
                // Se este dia atingiu o limite, remover da lista
                const newFilled = day.slots.filter(s => s.restaurantId).length;
                if (newFilled >= MAX_VISITS_PER_DAY) {
                    const dayIdx = daysToFill.findIndex(d => d.date === day.date);
                    if (dayIdx !== -1) {
                        daysToFill.splice(dayIdx, 1);
                        roundRobinIndex = 0; // Resetar índice quando remover um dia
                    }
                }
            } else {
                // Dia não tem mais slots vazios, remover da lista
                const dayIdx = daysToFill.findIndex(d => d.date === day.date);
                if (dayIdx !== -1) {
                    daysToFill.splice(dayIdx, 1);
                    roundRobinIndex = 0; // Resetar índice quando remover um dia
                }
            }
        }
        
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

