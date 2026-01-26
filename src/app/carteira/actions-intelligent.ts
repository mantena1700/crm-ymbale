'use server';

import { prisma } from '@/lib/db';

const MAX_VISITS_PER_DAY = 7;
// ⚠️ SUA CHAVE API
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyASOKtEiW5F-NkwvjApo0NcMYab6OF3nlg";

// --- HELPER MATEMÁTICO ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 99999;
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function deg2rad(deg: number) { return deg * (Math.PI / 180); }

// --- CONSULTA GOOGLE EM LOTE ---
async function getGoogleTravelTimesBatch(origin: { lat: number, lng: number }, destinations: any[]) {
    if (!GOOGLE_API_KEY || destinations.length === 0) return null;

    const results = new Map();
    const CHUNK_SIZE = 25;

    for (let i = 0; i < destinations.length; i += CHUNK_SIZE) {
        const chunk = destinations.slice(i, i + CHUNK_SIZE);
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = chunk.map(d => `${d.lat},${d.lng}`).join('|');
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_API_KEY}&mode=driving`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.rows?.[0]?.elements) {
                data.rows[0].elements.forEach((el: any, idx: number) => {
                    if (el.status === 'OK') {
                        results.set(chunk[idx].id, {
                            seconds: el.duration.value,
                            text: el.duration.text
                        });
                    }
                });
            }
        } catch (err) {
            console.error('Erro Google API:', err);
        }
    }
    return results;
}

// --- FETCH DE CLIENTES FIXOS (LOCAL PARA EVITAR CICLO) ---
export async function getFixedClientsForWeek(sellerId: string, weekStart: string) {
    try {
        const startDate = new Date(weekStart);
        // Ajustar para garantir que comece na data correta (sem hora)
        startDate.setHours(0, 0, 0, 0);

        const fixedClients = await prisma.fixedClient.findMany({
            where: {
                sellerId,
                active: true,
                restaurant: {
                    status: { not: 'Descartado' }
                }
            },
            include: {
                restaurant: true
            }
        });

        const byDay: Record<string, any[]> = {};

        // Inicializar dias da semana no map
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            byDay[dateStr] = [];
        }

        // Simplificação: Assumindo que o dia da semana está no JSON 'weeklyDays'
        // Como não sabemos o formato exato, vamos tentar interpretar
        // Se for array de strings: ["Segunda", "Quarta"] etc.
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        fixedClients.forEach(fc => {
            if (fc.recurrenceType === 'weekly' && Array.isArray(fc.weeklyDays)) {
                fc.weeklyDays.forEach((day: any) => {
                    // Tentar mapear o dia para uma data da semana atual
                    let targetDayIndex = -1;

                    if (typeof day === 'string') {
                        const normalizedDay = day.toLowerCase();
                        if (normalizedDay.includes('seg')) targetDayIndex = 1;
                        else if (normalizedDay.includes('ter')) targetDayIndex = 2;
                        else if (normalizedDay.includes('qua')) targetDayIndex = 3;
                        else if (normalizedDay.includes('qui')) targetDayIndex = 4;
                        else if (normalizedDay.includes('sex')) targetDayIndex = 5;
                        else if (normalizedDay.includes('sab')) targetDayIndex = 6;
                        else if (normalizedDay.includes('dom')) targetDayIndex = 0;
                    } else if (typeof day === 'number') {
                        targetDayIndex = day; // Assumindo 0-6
                    }

                    if (targetDayIndex !== -1) {
                        // Encontrar a data correspondente nesta semana
                        const startDayIndex = startDate.getDay();
                        const diff = targetDayIndex - startDayIndex + (targetDayIndex < startDayIndex ? 7 : 0); // Ajuste simples
                        // Mas 'startDate' pode ser qualquer dia. O correto é encontrar o dia na semana que corresponde.
                        // Assumindo que 'startDate' é o início da visualização (ex: Segunda).

                        // Melhor abordagem: Iterar pelos dias da semana (map byDay) e ver qual bate
                        Object.keys(byDay).forEach(dateStr => {
                            const d = new Date(dateStr);
                            // Ajustar timezone offset manual já que usamos string split
                            const userTimezoneOffset = d.getTimezoneOffset() * 60000;
                            const dt = new Date(d.getTime() + userTimezoneOffset);

                            if (dt.getDay() === targetDayIndex) {
                                byDay[dateStr].push({
                                    id: fc.id,
                                    restaurantId: fc.restaurantId,
                                    restaurantName: fc.restaurant?.name || 'Cliente Fixo',
                                    restaurantAddress: fc.restaurant?.address,
                                    radiusKm: Number(fc.radiusKm || 15),
                                    latitude: fc.latitude,
                                    longitude: fc.longitude
                                });
                            }
                        });
                    }
                });
            }
        });

        return byDay;
    } catch (error) {
        console.error('Erro ao buscar clientes fixos:', error);
        return {};
    }
}

// --- TIPOS ---
export interface FillSuggestion {
    id: string;
    day: string;
    date: string;
    restaurantId: string;
    restaurantName: string;
    reason: string;
    distance?: number;
    duration?: string;
}

export interface UserDecision {
    suggestionId: string;
    accepted: boolean;
    selectedRestaurantIds?: string[];
}

// --- FUNÇÃO DE ANÁLISE (PREVIEW) ---
export async function analyzeIntelligentFill(
    restaurants: any[],
    sellerId: string,
    weekStart: Date,
    existingSchedule: any[] = []
): Promise<FillSuggestion[]> {
    try {
        console.log('🔍 Análise de Preenchimento Inteligente...');

        // 1. Buscar clientes fixos
        const fixedClientsByDay = await getFixedClientsForWeek(sellerId, weekStart.toISOString());

        // Gerar uma agenda simulada
        const weekDays = await generateIntelligentWeeklySchedule(restaurants, sellerId, weekStart, existingSchedule, [], fixedClientsByDay);

        const suggestions: FillSuggestion[] = [];

        weekDays.forEach(day => {
            day.slots.forEach((slot: any) => {
                if (slot.restaurantId && !slot.isFixedClient) {
                    // Verificar se já estava agendado (para não sugerir o que já existe)
                    const alreadyScheduled = existingSchedule.some(ex =>
                        ex.restaurantId === slot.restaurantId &&
                        new Date(ex.scheduledDate).toDateString() === new Date(day.date).toDateString()
                    );

                    if (!alreadyScheduled) {
                        suggestions.push({
                            id: `${day.date}-${slot.time}-${slot.restaurantId}`,
                            day: day.day,
                            date: day.date,
                            restaurantId: slot.restaurantId,
                            restaurantName: slot.restaurantName,
                            reason: slot.details || 'Sugestão de agendamento',
                            distance: 0,
                            duration: ''
                        });
                    }
                }
            });
        });

        return suggestions;
    } catch (error) {
        console.error('Erro na análise:', error);
        return [];
    }
}

export async function generateIntelligentWeeklySchedule(
    restaurants: any[],
    sellerId: string,
    weekStart: Date,
    existingSchedule: any[] = [],
    userDecisions: UserDecision[] = [], // Adicionado suporte a decisões
    fixedClientsByDayArg: Record<string, any[]> | null = null // Argumento opcional
) {
    try {
        console.log('🚀 GERAÇÃO V9: OTIMIZAÇÃO GLOBAL (Semana Inteira)...');

        // 1. LISTA MESTRA DE RESTAURANTES E NORMALIZAÇÃO DE COORDENADAS
        const availableRestaurants = restaurants
            .filter(r => r.id && r.name && r.status !== 'Descartado')
            .map(r => {
                // Tenta pegar lat/lng da raiz ou do JSON de geocoding
                let lat = Number(r.lat || r.latitude || 0);
                let lng = Number(r.lng || r.longitude || 0);

                // Se for 0, tenta pegar do address se for objeto
                if (lat === 0 && lng === 0 && r.address && typeof r.address === 'object') {
                    // Lógica de fallback se coordenadas estiverem no address 
                    // (poderia implementar aqui, mas o re-fetch no actions.ts já deve trazer se estiver na raiz)
                }

                return {
                    id: r.id,
                    name: r.name,
                    lat: lat,
                    lng: lng,
                    score: (r.salesPotential === 'ALTISSIMO' ? 100 : r.salesPotential === 'ALTO' ? 75 : 50)
                };
            });

        console.log(`   📍 ${availableRestaurants.filter(r => r.lat !== 0).length} restaurantes com GPS válido de ${availableRestaurants.length}`);

        // 2. SETUP DA SEMANA (SEG-SEX)
        let fixedClientsByDay = fixedClientsByDayArg;
        if (!fixedClientsByDay) {
            try { fixedClientsByDay = await getFixedClientsForWeek(sellerId, weekStart.toISOString()) || {}; } catch (e) { fixedClientsByDay = {}; }
        }

        const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        const weekDays: any[] = [];
        const usedIds = new Set<string>();

        // Marcar IDs já agendados na semana atual (para não repetir)
        existingSchedule.forEach(ex => {
            if (ex.restaurantId) {
                usedIds.add(ex.restaurantId);
            }
        });

        // Montar estrutura e identificar âncoras
        for (let i = 0; i < 5; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const fixedToday = fixedClientsByDay?.[dateStr] || [];

            // Verificar agendamentos existentes manuais neste dia
            const manualToday = existingSchedule.filter(ex =>
                new Date(ex.scheduledDate).toISOString().split('T')[0] === dateStr
            );

            const slots = [];
            let fixedIdx = 0;
            let anchor = null;

            // Se tiver manuais com lat/lng, podem servir de âncora também
            manualToday.forEach(m => {
                const r = availableRestaurants.find(ar => ar.id === m.restaurantId);
                if (r && r.lat !== 0 && !anchor) {
                    anchor = { lat: r.lat, lng: r.lng, name: r.name };
                }
            });

            for (let j = 1; j <= MAX_VISITS_PER_DAY; j++) {
                // Se tem fixo, ocupa o slot
                if (fixedIdx < fixedToday.length) {
                    const fc = fixedToday[fixedIdx];
                    slots.push({ time: String(j), restaurantId: fc.restaurantId, restaurantName: fc.restaurantName, isFixedClient: true, details: 'Fixo' });
                    usedIds.add(fc.restaurantId);

                    if (!anchor && fc.latitude && fc.longitude) {
                        anchor = { lat: Number(fc.latitude), lng: Number(fc.longitude), name: fc.restaurantName };
                    }
                    fixedIdx++;
                } else {
                    // Preenchimento de slots CONSIDERANDO manuais existentes
                    // A "quantidade" de manuais ocupa slots lógicos

                    const manualCount = manualToday.length;

                    // Se o índice atual 'j' for maior que (fixos + manuais), é um slot livre
                    // (Lógica simples de balde, não de horário exato)

                    if (j <= fixedToday.length + manualCount) {
                        // É um slot ocupado por manual (abstração)
                        // Não tentamos exibir o manual específico no slot específico aqui, 
                        // apenas "queimamos" o slot para que a IA não use.
                        // MAS, se quisermos mostrar na preview, seria bom.

                        const m = manualToday[j - fixedToday.length - 1];
                        if (m) {
                            slots.push({
                                time: String(j),
                                restaurantId: m.restaurantId,
                                restaurantName: m.restaurant.name,
                                isFixedClient: false,
                                details: 'Agendado Manualmente'
                            });
                        } else {
                            slots.push({ time: String(j), restaurantId: null, restaurantName: null });
                        }
                    } else {
                        // Slot livre para IA
                        slots.push({ time: String(j), restaurantId: null, restaurantName: null });
                    }
                }
            }

            weekDays.push({ day: daysOfWeek[i], date: dateStr, slots, anchor, index: i });
        }

        // =================================================================================
        // FASE 1: OTIMIZAÇÃO GLOBAL (TODOS OS DIAS AO MESMO TEMPO)
        // =================================================================================
        console.log('\n🌎 FASE 1: Calculando Matriz Global de Tempos...');

        let allMatches: any[] = [];

        for (const day of weekDays) {
            if (!day.anchor) continue;

            // 1. Pré-filtro Matemático (Raio 20km da âncora)
            let candidates = availableRestaurants.filter(r => !usedIds.has(r.id) && r.lat !== 0);
            candidates = candidates.filter(r => {
                const dist = getDistanceFromLatLonInKm(day.anchor.lat, day.anchor.lng, r.lat, r.lng);
                return dist <= 20; // 20km
            });

            if (candidates.length === 0) continue;

            // 2. Consulta Google
            console.log(`   📡 Consultando Google para ${day.day} (${candidates.length} candidatos)...`);
            const googleResults = await getGoogleTravelTimesBatch(day.anchor, candidates);

            if (googleResults) {
                candidates.forEach(r => {
                    const data = googleResults.get(r.id);
                    if (data) {
                        allMatches.push({
                            dayIndex: day.index,
                            dayName: day.day,
                            restaurant: r,
                            seconds: data.seconds,
                            text: data.text
                        });
                    }
                });
            }
        }

        // 3. ORDENAÇÃO E ATRIBUIÇÃO GLOBAL
        // O match mais rápido da semana inteira ganha primeiro
        allMatches.sort((a, b) => a.seconds - b.seconds);

        console.log(`   🏆 Processando ${allMatches.length} rotas possíveis...`);

        for (const match of allMatches) {
            const r = match.restaurant;
            const day = weekDays[match.dayIndex];

            if (usedIds.has(r.id)) continue;

            const emptySlot = day.slots.find((s: any) => !s.restaurantId);

            // Só agenda se o tempo for bom (< 20 min) para não fazer viagens longas
            if (emptySlot && match.seconds < 1200) {
                emptySlot.restaurantId = r.id;
                emptySlot.restaurantName = r.name;
                emptySlot.details = `🚗 ${match.text} do ponto de ref.`;
                usedIds.add(r.id);
                console.log(`      ✅ ${r.name} -> ${day.day} (${match.text})`);
            }
        }

        // =================================================================================
        // FASE 2: PREENCHIMENTO DAS SOBRAS (ROUND ROBIN PURO)
        // =================================================================================
        console.log('\n📊 FASE 2: Distribuindo o restante (Round Robin)...');

        const leftovers = availableRestaurants.filter(r => !usedIds.has(r.id)).sort((a, b) => b.score - a.score);
        let dayIdx = 0;

        for (const r of leftovers) {
            // Acha dias com vaga
            const activeDays = weekDays.filter(d => d.slots.some((s: any) => !s.restaurantId));
            if (activeDays.length === 0) break;

            // Round Robin: Garante que muda de dia a cada inserção
            const targetDay = activeDays[dayIdx % activeDays.length];
            const slot = targetDay.slots.find((s: any) => !s.restaurantId);

            if (slot) {
                slot.restaurantId = r.id;
                slot.restaurantName = r.name;
                slot.details = r.lat ? 'Preenchimento (GPS Distante)' : 'Sem Localização (Aleatório)';
                usedIds.add(r.id);
                dayIdx++; // <--- ISSO IMPEDE DE ENCHER SÓ A SEGUNDA
            }
        }

        return weekDays;

    } catch (error) {
        console.error('❌ ERRO:', error);
        throw error;
    }
}

export async function optimizeRouteWithAI() { return { route: [], totalDistance: 0, estimatedTime: 0 }; }
