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

    console.log(`google_api: requesting matrix for ${destinations.length} destinations...`);
    const results = new Map();
    const CHUNK_SIZE = 25;

    for (let i = 0; i < destinations.length; i += CHUNK_SIZE) {
        const chunk = destinations.slice(i, i + CHUNK_SIZE);
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = chunk.map(d => `${d.lat},${d.lng}`).join('|');
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_API_KEY}&mode=driving`;

        try {
            // Timeout de 2 segundos para não travar
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

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
            console.warn('Erro/Timeout Google API (usando dist linear):', err);
            // Não dar throw, apenas continuar (vai usar fallback de distância linear)
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
        console.log('🚀 GERAÇÃO V10: CLUSTERING DINÂMICO...');

        // 1. LISTA MESTRA e COORDENADAS
        const availableRestaurants = restaurants
            .filter(r => r.id && r.name && r.status !== 'Descartado')
            .map(r => {
                let lat = Number(r.lat || r.latitude || 0);
                let lng = Number(r.lng || r.longitude || 0);

                // Tentar extrair do address se não tiver na raiz
                if ((lat === 0 || isNaN(lat)) && r.address) {
                    try {
                        const addr = typeof r.address === 'string' ? JSON.parse(r.address) : r.address;
                        if (addr.lat && addr.lng) {
                            lat = Number(addr.lat);
                            lng = Number(addr.lng);
                        } else if (addr.latitude && addr.longitude) {
                            lat = Number(addr.latitude);
                            lng = Number(addr.longitude);
                        }
                    } catch (e) { }
                }

                return {
                    id: r.id,
                    name: r.name,
                    lat: isNaN(lat) ? 0 : lat,
                    lng: isNaN(lng) ? 0 : lng,
                    score: (r.salesPotential === 'ALTISSIMO' ? 100 : r.salesPotential === 'ALTO' ? 75 : 50)
                };
            });

        const withCoords = availableRestaurants.filter(r => r.lat !== 0);
        console.log(`   📍 ${withCoords.length} com GPS válido de ${availableRestaurants.length}`);

        // 2. SETUP DA SEMANA e ANCORAS INICIAIS
        let fixedClientsByDay = fixedClientsByDayArg;
        if (!fixedClientsByDay) {
            try { fixedClientsByDay = await getFixedClientsForWeek(sellerId, weekStart.toISOString()) || {}; } catch (e) { fixedClientsByDay = {}; }
        }

        const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        const weekDays: any[] = [];
        const usedIds = new Set<string>();

        existingSchedule.forEach(ex => { if (ex.restaurantId) usedIds.add(ex.restaurantId); });

        // Inicializar dias
        for (let i = 0; i < 5; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            const fixedToday = fixedClientsByDay?.[dateStr] || [];
            const manualToday = existingSchedule.filter(ex =>
                new Date(ex.scheduledDate).toISOString().split('T')[0] === dateStr
            );

            // Identificar âncora inicial (Fixo ou Manual de hoje)
            let anchor = null;

            // Fixo é a melhor âncora
            const fixedWithCoords = fixedToday.find((fc: any) => fc.latitude && fc.longitude);
            if (fixedWithCoords) {
                anchor = { lat: Number(fixedWithCoords.latitude), lng: Number(fixedWithCoords.longitude), name: fixedWithCoords.restaurantName };
            }

            // Se não tiver fixo, tenta manual
            if (!anchor) {
                const manualWithCoords = manualToday.find(m => {
                    const r = availableRestaurants.find(ar => ar.id === m.restaurantId);
                    return r && r.lat !== 0;
                });
                if (manualWithCoords) {
                    const r = availableRestaurants.find(ar => ar.id === manualWithCoords.restaurantId)!;
                    anchor = { lat: r.lat, lng: r.lng, name: r.name };
                }
            }

            // Ocupar slots
            const slots = [];
            let currentSlotIdx = 1;

            // Arrojar fixos
            fixedToday.forEach((fc: any) => {
                if (currentSlotIdx <= MAX_VISITS_PER_DAY) {
                    slots.push({ time: String(currentSlotIdx++), restaurantId: fc.restaurantId, restaurantName: fc.restaurantName, isFixedClient: true, details: 'Cliente Fixo' });
                    usedIds.add(fc.restaurantId);
                }
            });

            // Arrojar manuais (abstração de ocupação)
            manualToday.forEach(m => {
                if (currentSlotIdx <= MAX_VISITS_PER_DAY) {
                    slots.push({ time: String(currentSlotIdx++), restaurantId: m.restaurantId, restaurantName: m.restaurant?.name || 'Manual', isFixedClient: false, details: 'Agendado Manualmente' });
                    usedIds.add(m.restaurantId);
                }
            });

            // Criar vagas vazias
            while (currentSlotIdx <= MAX_VISITS_PER_DAY) {
                slots.push({ time: String(currentSlotIdx++), restaurantId: null, restaurantName: null });
            }

            weekDays.push({ day: daysOfWeek[i], date: dateStr, slots, anchor, index: i });
        }


        // ===================================
        // FASE 3: AUTO-ANCORAGEM e CLUSTERING
        // ===================================
        // Se um dia não tem âncora (fixo/manual), escolhemos o MELHOR restaurante disponível para ser a âncora
        // E preenchemos o dia ao redor dele.

        for (const day of weekDays) {
            // Se o dia já está cheio, pula
            if (!day.slots.some((s: any) => !s.restaurantId)) continue;
            // Se não tem GPS suficiente, pula
            if (withCoords.length === 0) continue;

            // Se não tem âncora, criar uma!
            if (!day.anchor) {
                // Pegar o restaurante disponível com maior score (Altíssimo potencial) que tenha GPS
                const bestCandidate = availableRestaurants
                    .filter(r => !usedIds.has(r.id) && r.lat !== 0)
                    .sort((a, b) => b.score - a.score)[0]; // Maior score primeiro

                if (bestCandidate) {
                    // Eleger como Âncora Virtual
                    day.anchor = { lat: bestCandidate.lat, lng: bestCandidate.lng, name: bestCandidate.name };

                    // Colocar ele no primeiro slot vazio
                    const slot = day.slots.find((s: any) => !s.restaurantId);
                    if (slot) {
                        slot.restaurantId = bestCandidate.id;
                        slot.restaurantName = bestCandidate.name;
                        slot.details = 'Ponto de Partida (Sugerido)';
                        usedIds.add(bestCandidate.id);
                        console.log(`⚓ Novo Ponto de Partida para ${day.day}: ${bestCandidate.name}`);
                    }
                }
            }

            // Agora preencher o resto do dia com vizinhos da âncora (se existir)
            if (day.anchor) {
                let neighbors = availableRestaurants
                    .filter(r => !usedIds.has(r.id) && r.lat !== 0)
                    .map(r => ({
                        ...r,
                        dist: getDistanceFromLatLonInKm(day.anchor.lat, day.anchor.lng, r.lat, r.lng)
                    }))
                    .filter(r => r.dist < 25) // Raio de 25km
                    .sort((a, b) => a.dist - b.dist); // Mais próximos primeiro

                // Preencher slots vazios com vizinhos
                for (const slot of day.slots) {
                    if (!slot.restaurantId && neighbors.length > 0) {
                        const neighbor = neighbors.shift(); // Pega o mais próximo e remove da lista
                        if (neighbor) {
                            slot.restaurantId = neighbor.id;
                            slot.restaurantName = neighbor.name;
                            slot.details = `📍 ${neighbor.dist.toFixed(1)}km de ${day.anchor.name}`;
                            usedIds.add(neighbor.id);
                        }
                    }
                }
            }
        }

        // ===================================
        // FASE 4: SOBRAS (LAST RESORT)
        // ===================================
        // Se ainda sobraram slots e restaurantes, preenche sequencialmente
        const leftovers = availableRestaurants.filter(r => !usedIds.has(r.id)).sort((a, b) => b.score - a.score);
        let currentDayIdx = 0;

        for (const r of leftovers) {
            // Achar um dia com vaga (começando de currentDayIdx para distribuir)
            let foundSlot = false;
            for (let k = 0; k < 5; k++) {
                const dayIdx = (currentDayIdx + k) % 5;
                const targetDay = weekDays[dayIdx];
                const slot = targetDay.slots.find((s: any) => !s.restaurantId);

                if (slot) {
                    slot.restaurantId = r.id;
                    slot.restaurantName = r.name;
                    slot.details = r.lat ? 'Preenchimento Extra' : 'Sem GPS (Aleatório)';
                    usedIds.add(r.id);
                    foundSlot = true;
                    // Avançar ponteiro do dia só se achou, pra tentar equilibrar
                    currentDayIdx = (dayIdx + 1) % 5;
                    break;
                }
            }
            if (!foundSlot && leftovers.length > 100) break; // Otimização para não rodar infinito se tudo cheio
        }

        return weekDays;

    } catch (error: any) {
        console.error('❌ ERRO:', error);
        throw new Error(error.message || 'Erro ao gerar agenda inteligente'); // Re-throw para o client ver
    }
}

export async function optimizeRouteWithAI() { return { route: [], totalDistance: 0, estimatedTime: 0 }; }
