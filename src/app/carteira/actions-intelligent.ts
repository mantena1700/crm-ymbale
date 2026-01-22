'use server';

import { prisma } from '@/lib/db';
import { getFixedClientsForWeek } from './actions';

const MAX_VISITS_PER_DAY = 6;
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

export async function generateIntelligentWeeklySchedule(
    restaurants: any[],
    sellerId: string,
    weekStart: Date,
    existingSchedule: any[] = []
) {
    try {
        console.log('🚀 GERAÇÃO V9: OTIMIZAÇÃO GLOBAL (Semana Inteira)...');

        // 1. LISTA MESTRA DE RESTAURANTES
        const availableRestaurants = restaurants
            .filter(r => r.id && r.name && r.status !== 'Descartado')
            .map(r => ({
                id: r.id,
                name: r.name,
                lat: Number(r.lat || r.latitude || 0),
                lng: Number(r.lng || r.longitude || 0),
                score: (r.salesPotential === 'ALTISSIMO' ? 100 : r.salesPotential === 'ALTO' ? 75 : 50)
            }));

        // 2. SETUP DA SEMANA (SEG-SEX)
        let fixedClientsByDay: Record<string, any[]> = {};
        try { fixedClientsByDay = await getFixedClientsForWeek(sellerId, weekStart.toISOString()) || {}; } catch (e) { }

        const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        const weekDays: any[] = [];
        const usedIds = new Set<string>();
        existingSchedule.forEach(ex => { if (ex.restaurantId) usedIds.add(ex.restaurantId); });

        // Montar estrutura e identificar âncoras
        for (let i = 0; i < 5; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const fixedToday = fixedClientsByDay[dateStr] || [];

            const slots = [];
            let fixedIdx = 0;
            let anchor = null;

            for (let j = 1; j <= MAX_VISITS_PER_DAY; j++) {
                if (fixedIdx < fixedToday.length) {
                    const fc = fixedToday[fixedIdx];
                    slots.push({ time: String(j), restaurantId: fc.restaurantId, restaurantName: fc.restaurantName, isFixedClient: true, details: 'Fixo' });
                    usedIds.add(fc.restaurantId);

                    if (!anchor && fc.latitude && fc.longitude) {
                        anchor = { lat: Number(fc.latitude), lng: Number(fc.longitude), name: fc.restaurantName };
                    }
                    fixedIdx++;
                } else {
                    slots.push({ time: String(j), restaurantId: null, restaurantName: null });
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
                return dist <= 20;
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
                emptySlot.details = `🚗 ${match.text} do fixo`;
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
                slot.details = r.lat ? 'Preenchimento (GPS)' : 'Sem Localização';
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

export async function analyzeIntelligentFill() { return []; }
export async function optimizeRouteWithAI() { return { route: [], totalDistance: 0, estimatedTime: 0 }; }
