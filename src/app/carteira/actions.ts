'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { generateIntelligentWeeklySchedule, getFixedClientsForWeek } from './actions-intelligent';
import { calculateDistance, getCoordinatesFromAddress } from '@/lib/distance-calculator';
import { getCoordinatesFromAddressWithGoogle, calculateBatchDistances, geocodeAddress } from '@/lib/google-maps';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { logSystemActivity } from '@/lib/audit';

// Agendar visita
export async function scheduleVisit(
    restaurantId: string,
    sellerId: string,
    date: string,
    notes?: string
) {
    try {
        // Criar follow-up
        await prisma.followUp.create({
            data: {
                restaurantId,
                type: 'meeting',
                scheduledDate: new Date(date),
                notes: notes || null,
                completed: false
            }
        });

        // Criar notificação
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId }
        });

        await prisma.notification.create({
            data: {
                type: 'followup',
                title: '📅 Visita Agendada',
                message: `Visita agendada para ${restaurant?.name || 'cliente'} em ${new Date(date).toLocaleDateString('pt-BR')}`,
                metadata: { restaurantId, sellerId, date }
            }
        });

        revalidatePath('/carteira');
        revalidatePath('/agenda');

        return { success: true };
    } catch (error) {
        console.error('Erro ao agendar visita:', error);
        return { success: false, error: 'Erro ao agendar visita' };
    }
}

// Atualizar prioridade do cliente
export async function updateClientPriority(restaurantId: string, priority: string) {
    try {
        await prisma.restaurant.update({
            where: { id: restaurantId },
            data: { salesPotential: priority }
        });

        revalidatePath('/carteira');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar prioridade:', error);
        return { success: false, error: 'Erro ao atualizar prioridade' };
    }
}

// Atualizar status do cliente
export async function updateClientStatus(restaurantId: string, status: string) {
    try {
        await prisma.restaurant.update({
            where: { id: restaurantId },
            data: { status }
        });

        // Criar atividade
        await prisma.activityLog.create({
            data: {
                type: 'status_change',
                title: 'Status Atualizado',
                description: `Status alterado para "${status}"`,
                restaurantId
            }
        });

        revalidatePath('/carteira');
        revalidatePath('/pipeline');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        return { success: false, error: 'Erro ao atualizar status' };
    }
}

// Adicionar nota ao cliente
export async function addNote(restaurantId: string, content: string) {
    try {
        await prisma.note.create({
            data: {
                restaurantId,
                content
            }
        });

        revalidatePath('/carteira');
        return { success: true };
    } catch (error) {
        console.error('Erro ao adicionar nota:', error);
        return { success: false, error: 'Erro ao adicionar nota' };
    }
}

// Atribuir cliente a vendedor
export async function assignClientToSeller(restaurantId: string, sellerId: string) {
    try {
        await prisma.restaurant.update({
            where: { id: restaurantId },
            data: {
                sellerId,
                assignedAt: new Date()
            }
        });

        revalidatePath('/carteira');
        revalidatePath('/sellers');

        return { success: true };
    } catch (error) {
        console.error('Erro ao atribuir cliente:', error);
        return { success: false, error: 'Erro ao atribuir cliente' };
    }
}

// Obter estatísticas da carteira
export async function getCarteiraStats(sellerId: string) {
    try {
        const seller = await prisma.seller.findUnique({
            where: { id: sellerId }
        });

        if (!seller) {
            return { success: false, error: 'Vendedor não encontrado' };
        }

        const restaurants = await prisma.restaurant.findMany({
            where: { sellerId }
        });

        const stats = {
            total: restaurants.length,
            byStatus: {
                'A Analisar': restaurants.filter(r => r.status === 'A Analisar').length,
                'Qualificado': restaurants.filter(r => r.status === 'Qualificado').length,
                'Contatado': restaurants.filter(r => r.status === 'Contatado').length,
                'Negociação': restaurants.filter(r => r.status === 'Negociação').length,
                'Fechado': restaurants.filter(r => r.status === 'Fechado').length,
            },
            byPotential: {
                'ALTISSIMO': restaurants.filter(r => r.salesPotential === 'ALTISSIMO').length,
                'ALTO': restaurants.filter(r => r.salesPotential === 'ALTO').length,
                'MEDIO': restaurants.filter(r => r.salesPotential === 'MEDIO').length,
                'BAIXO': restaurants.filter(r => r.salesPotential === 'BAIXO').length,
            }
        };

        return { success: true, stats };
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        return { success: false, error: 'Erro ao obter estatísticas' };
    }
}

// Marcar visita como realizada
export async function completeVisit(followUpId: string, feedback: string, outcome: string) {
    try {
        const followUp = await prisma.followUp.update({
            where: { id: followUpId },
            data: {
                completed: true,
                completedDate: new Date(),
                notes: feedback
            },
            include: {
                restaurant: true
            }
        });

        // Criar registro de visita
        try {
            await prisma.visit.create({
                data: {
                    restaurantId: followUp.restaurantId,
                    sellerId: followUp.restaurant.sellerId || '',
                    visitDate: new Date(),
                    feedback,
                    outcome
                }
            });
        } catch (e) {
            console.log('Erro ao criar registro de visita:', e);
        }

        revalidatePath('/carteira');
        revalidatePath('/agenda');

        return { success: true };
    } catch (error) {
        console.error('Erro ao completar visita:', error);
        return { success: false, error: 'Erro ao completar visita' };
    }
}

// Salvar agendamento semanal
export async function saveWeeklySchedule(
    sellerId: string,
    date: string,
    time: string,
    restaurantId: string | null
) {
    try {
        // Usar meio-dia como hora padrão (apenas para armazenar a data)
        // O horário não será usado na visualização
        const scheduledDateTime = new Date(date);
        scheduledDateTime.setHours(12, 0, 0, 0); // Meio-dia padrão

        if (restaurantId) {
            // Verificar se já existe agendamento neste horário para este restaurante
            const existing = await prisma.followUp.findFirst({
                where: {
                    restaurantId,
                    scheduledDate: {
                        gte: new Date(scheduledDateTime.getTime() - 30 * 60000), // 30 min antes
                        lte: new Date(scheduledDateTime.getTime() + 30 * 60000)  // 30 min depois
                    },
                    completed: false
                }
            });

            if (existing) {
                // Atualizar existente
                await prisma.followUp.update({
                    where: { id: existing.id },
                    data: {
                        scheduledDate: scheduledDateTime,
                        type: 'meeting',
                        completed: false
                    }
                });
            } else {
                // Verificar se já existe outro restaurante neste horário
                const conflicting = await prisma.followUp.findFirst({
                    where: {
                        scheduledDate: {
                            gte: new Date(scheduledDateTime.getTime() - 30 * 60000),
                            lte: new Date(scheduledDateTime.getTime() + 30 * 60000)
                        },
                        completed: false
                    }
                });

                if (conflicting) {
                    // Remover conflito anterior
                    await prisma.followUp.delete({
                        where: { id: conflicting.id }
                    });
                }

                // Criar novo
                await prisma.followUp.create({
                    data: {
                        restaurantId,
                        type: 'meeting',
                        scheduledDate: scheduledDateTime,
                        completed: false,
                        notes: 'Prospecção semanal'
                    }
                });
            }
        } else {
            // Remover agendamento neste horário
            await prisma.followUp.deleteMany({
                where: {
                    scheduledDate: {
                        gte: new Date(scheduledDateTime.getTime() - 30 * 60000),
                        lte: new Date(scheduledDateTime.getTime() + 30 * 60000)
                    },
                    completed: false
                }
            });
        }

        revalidatePath('/carteira');
        return { success: true };
    } catch (error) {
        console.error('Erro ao salvar agendamento semanal:', error);
        return { success: false, error: 'Erro ao salvar agendamento' };
    }
}

// Deletar múltiplos agendamentos da semana
export async function deleteMultipleScheduleSlots(followUpIds: string[]) {
    'use server';

    try {
        if (!followUpIds || followUpIds.length === 0) {
            return { success: false, error: 'Nenhum agendamento selecionado' };
        }

        // Deletar os follow-ups selecionados
        await prisma.followUp.deleteMany({
            where: {
                id: { in: followUpIds },
                completed: false // Apenas agendamentos não concluídos
            }
        });

        revalidatePath('/carteira');
        return {
            success: true,
            deleted: followUpIds.length,
            message: `${followUpIds.length} agendamento(s) removido(s) com sucesso`
        };
    } catch (error: any) {
        console.error('Erro ao deletar agendamentos:', error);
        return { success: false, error: error.message || 'Erro ao deletar agendamentos' };
    }
}

// Obter agendamentos semanais
// Preenchimento automático inteligente da semana
// Preenchimento automático inteligente da semana
export async function autoFillWeeklySchedule(
    sellerId: string,
    restaurantsIgnored: any[], // Ignored, we'll fetch fresh data
    weekStart: string,
    userDecisions: any[] = []
) {
    try {
        console.log('🚀 Iniciando preenchimento automático (Server-Side Fetch)...');
        console.log(`📊 Seller ID: ${sellerId}`);
        console.log(`📊 Semana: ${weekStart}`);
        console.log(`📊 Decisões do usuário: ${userDecisions.length}`);

        if (!sellerId) {
            return { success: false, error: 'ID do vendedor não informado' };
        }

        const weekStartDate = new Date(weekStart);

        // Garantir que a data é válida
        if (isNaN(weekStartDate.getTime())) {
            return { success: false, error: 'Data de início da semana inválida' };
        }

        // 1. RE-FETCH COMPLETO DOS RESTAURANTES (para garantir lat/lng)
        const restaurants = await prisma.restaurant.findMany({
            where: {
                sellerId: sellerId,
                status: { not: 'Descartado' } // Filtrar descartados
            }
        });

        console.log(`   📦 Restaurantes carregados do banco: ${restaurants.length}`);

        // Verificação de coordenadas
        const withCoords = restaurants.filter(r => r.latitude && r.longitude).length;
        console.log(`   📍 Restaurantes com coordenadas: ${withCoords}`);

        if (restaurants.length === 0) {
            return { success: false, error: 'Nenhum restaurante disponível para agendar' };
        }

        // Buscar agendamentos existentes para a semana
        const weekEnd = new Date(weekStartDate);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const existingSchedule = await prisma.followUp.findMany({
            where: {
                scheduledDate: {
                    gte: weekStartDate,
                    lt: weekEnd,
                },
                restaurant: {
                    sellerId: sellerId,
                },
                completed: false,
            },
            include: {
                restaurant: true,
            },
        });

        console.log(`📌 Agendamentos existentes encontrados: ${existingSchedule.length}`);

        // 2. BUSCAR CLIENTES FIXOS
        const fixedClientsByDay = await getFixedClientsForWeek(sellerId, weekStartDate.toISOString());

        const schedule = await generateIntelligentWeeklySchedule(
            restaurants,
            sellerId,
            weekStartDate,
            existingSchedule,
            userDecisions,
            fixedClientsByDay
        );

        if (!schedule || schedule.length === 0) {
            return { success: false, error: 'Não foi possível gerar a agenda. Verifique se há restaurantes disponíveis.' };
        }

        console.log(`📅 Agenda gerada: ${schedule.length} dias`);

        // Salvar no banco usando FollowUp
        const savedSlots = [];
        let errors = 0;

        for (const day of schedule) {
            for (const slot of day.slots) {
                if (slot.restaurantId) {
                    try {
                        // Criar data/hora completa
                        // slot.time agora é um índice de visita (1-8), não um horário
                        // Usar hora padrão 12:00 para todos os agendamentos
                        const scheduledDateTime = new Date(day.date);
                        scheduledDateTime.setHours(12, 0, 0, 0); // Hora padrão (meio-dia)

                        // Verificar se já existe follow-up neste dia para este restaurante
                        // (comparar por dia completo, não por horário específico)
                        const dayStart = new Date(scheduledDateTime);
                        dayStart.setHours(0, 0, 0, 0);
                        const dayEnd = new Date(scheduledDateTime);
                        dayEnd.setHours(23, 59, 59, 999);

                        const existing = await prisma.followUp.findFirst({
                            where: {
                                restaurantId: slot.restaurantId,
                                scheduledDate: {
                                    gte: dayStart,
                                    lte: dayEnd
                                },
                                completed: false
                            }
                        });

                        if (!existing) {
                            await prisma.followUp.create({
                                data: {
                                    restaurantId: slot.restaurantId,
                                    type: 'meeting',
                                    scheduledDate: scheduledDateTime,
                                    completed: false,
                                    notes: 'Agendamento automático inteligente - Prospecção',
                                },
                            });
                            savedSlots.push({
                                date: day.date,
                                time: slot.time,
                                restaurantId: slot.restaurantId,
                                restaurantName: slot.restaurantName
                            });
                            console.log(`✅ Salvo: ${slot.restaurantName} em ${day.date} (visita ${slot.time})`);
                        } else {
                            console.log(`⚠️ Já existe agendamento para ${slot.restaurantName} neste dia`);
                        }
                    } catch (slotError) {
                        console.error(`❌ Erro ao salvar slot:`, slotError);
                        errors++;
                    }
                }
            }
        }

        revalidatePath('/carteira');
        revalidatePath('/agenda');

        if (savedSlots.length === 0) {
            if (errors > 0) {
                return { success: false, error: `Erro ao salvar agendamentos. ${errors} falhas.` };
            }
            // Se já estava cheio e não salvou nada, pode não ser um erro perse, mas avisa o user
            if (existingSchedule.length > 0) {
                return { success: true, schedule: [], total: 0, message: "Agenda já estava completa ou sem slots disponíveis." };
            }
            return { success: false, error: 'Todos os horários já estavam preenchidos ou houve erro.' };
        }

        console.log(`✅ Total salvo: ${savedSlots.length} agendamentos`);
        return { success: true, schedule: savedSlots, total: savedSlots.length };
    } catch (error: any) {
        console.error('❌ Erro ao preencher agenda automaticamente:', error);
        return { success: false, error: error.message || 'Erro ao preencher agenda automaticamente' };
    }
}

export async function getWeeklySchedule(sellerId: string, weekStart: string) {
    try {
        const startDate = new Date(weekStart);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        endDate.setHours(23, 59, 59, 999);

        // Buscar follow-ups da semana para restaurantes do vendedor
        const followUps = await prisma.followUp.findMany({
            where: {
                scheduledDate: {
                    gte: startDate,
                    lte: endDate
                },
                completed: false,
                restaurant: {
                    OR: [
                        { sellerId: sellerId },
                        // Também buscar por região/bairro se necessário
                    ]
                }
            },
            include: {
                restaurant: true
            },
            orderBy: {
                scheduledDate: 'asc'
            }
        });

        // Agrupar por data e atribuir índices de visita (1-8)
        const visitsByDate: { [date: string]: typeof followUps } = {};
        followUps.forEach(f => {
            const date = new Date(f.scheduledDate).toISOString().split('T')[0];
            if (!visitsByDate[date]) visitsByDate[date] = [];
            visitsByDate[date].push(f);
        });

        // Converter para slots com índices de visita
        const slots: Array<{ id: string; restaurantId: string; restaurantName: string; time: string; date: string; visitIndex?: number }> = [];
        Object.keys(visitsByDate).forEach(date => {
            visitsByDate[date].forEach((f, index) => {
                const visitIndex = index + 1; // 1 a 8
                slots.push({
                    id: f.id,
                    restaurantId: f.restaurantId,
                    restaurantName: f.restaurant.name,
                    time: String(visitIndex), // Usar índice como time para compatibilidade
                    date: date,
                    visitIndex: visitIndex
                });
            });
        });

        return slots;
    } catch (error) {
        console.error('Erro ao buscar agendamentos semanais:', error);
        return [];
    }
}

// Aplicar reorganização inteligente da agenda
export async function applyScheduleReorganization(
    sellerId: string,
    reorganizations: Array<{
        restaurantId: string;
        fromDate: string;
        toDate: string;
        fromTime: string;
        toTime?: string;
    }>
) {
    try {
        const results = [];

        for (const reorg of reorganizations) {
            // Encontrar o follow-up existente
            const fromDateStart = new Date(reorg.fromDate);
            fromDateStart.setHours(0, 0, 0, 0);
            const fromDateEnd = new Date(reorg.fromDate);
            fromDateEnd.setHours(23, 59, 59, 999);

            const existingFollowUp = await prisma.followUp.findFirst({
                where: {
                    restaurantId: reorg.restaurantId,
                    scheduledDate: {
                        gte: fromDateStart,
                        lte: fromDateEnd
                    },
                    completed: false
                }
            });

            if (!existingFollowUp) {
                console.warn(`Follow-up não encontrado para ${reorg.restaurantId} em ${reorg.fromDate}`);
                results.push({ restaurantId: reorg.restaurantId, success: false, error: 'Follow-up não encontrado' });
                continue;
            }

            // Criar nova data mantendo o horário ou usando o novo
            const newDate = new Date(reorg.toDate);
            const timeToUse = reorg.toTime || reorg.fromTime;
            const [hours, minutes] = timeToUse.split(':').map(Number);
            newDate.setHours(hours, minutes, 0, 0);

            // Atualizar o follow-up
            await prisma.followUp.update({
                where: { id: existingFollowUp.id },
                data: { scheduledDate: newDate }
            });

            results.push({ restaurantId: reorg.restaurantId, success: true });
        }

        // Criar notificação
        await prisma.notification.create({
            data: {
                type: 'optimization',
                title: '🧠 Agenda Otimizada',
                message: `${results.filter(r => r.success).length} visita(s) foram reorganizada(s) para otimizar suas rotas.`,
                metadata: { sellerId, reorganizations: results }
            }
        });

        revalidatePath('/carteira');
        revalidatePath('/agenda');

        return {
            success: true,
            results,
            message: `${results.filter(r => r.success).length} de ${reorganizations.length} reorganizações aplicadas com sucesso!`
        };
    } catch (error) {
        console.error('Erro ao aplicar reorganização:', error);
        return { success: false, error: 'Erro ao aplicar reorganização' };
    }
}

// Otimizar agenda da semana inteira automaticamente
export async function autoOptimizeWeekSchedule(
    sellerId: string,
    weekStart: string,
    restaurantLocations: Record<string, { lat: number; lng: number }>
) {
    try {
        // Buscar todos os agendamentos da semana
        const schedule = await getWeeklySchedule(sellerId, weekStart);

        if (schedule.length < 2) {
            return { success: false, error: 'Não há agendamentos suficientes para otimizar' };
        }

        // Agrupar por dia
        const byDay: Record<string, typeof schedule> = {};
        schedule.forEach(slot => {
            if (!byDay[slot.date]) byDay[slot.date] = [];
            byDay[slot.date].push(slot);
        });

        // Função para calcular distância
        const calculateDistance = (loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }): number => {
            const R = 6371;
            const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
            const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        // Encontrar o melhor dia para cada restaurante baseado em proximidade
        const reorganizations: Array<{
            restaurantId: string;
            fromDate: string;
            toDate: string;
            fromTime: string;
        }> = [];

        const days = Object.keys(byDay).sort();

        for (const day of days) {
            const daySlots = byDay[day];
            if (daySlots.length < 2) continue;

            // Calcular distância total do dia
            let problemFound = false;

            for (let i = 0; i < daySlots.length - 1; i++) {
                const loc1 = restaurantLocations[daySlots[i].restaurantId];
                const loc2 = restaurantLocations[daySlots[i + 1].restaurantId];

                if (!loc1 || !loc2) continue;

                const distance = calculateDistance(loc1, loc2);

                // Se distância > 10km, procurar melhor dia
                if (distance > 10) {
                    problemFound = true;
                    const problematicSlot = daySlots[i + 1];
                    const problematicLoc = loc2;

                    // Procurar melhor dia para este restaurante
                    let bestDay = day;
                    let bestDistance = distance;

                    for (const otherDay of days) {
                        if (otherDay === day) continue;

                        const otherSlots = byDay[otherDay];
                        if (!otherSlots || otherSlots.length === 0) continue;

                        // Calcular distância média para restaurantes deste dia
                        let totalDist = 0;
                        let count = 0;

                        for (const otherSlot of otherSlots) {
                            const otherLoc = restaurantLocations[otherSlot.restaurantId];
                            if (otherLoc) {
                                totalDist += calculateDistance(problematicLoc, otherLoc);
                                count++;
                            }
                        }

                        if (count > 0) {
                            const avgDist = totalDist / count;
                            if (avgDist < bestDistance) {
                                bestDistance = avgDist;
                                bestDay = otherDay;
                            }
                        }
                    }

                    // Se encontrou um dia melhor, adicionar à lista de reorganizações
                    if (bestDay !== day) {
                        reorganizations.push({
                            restaurantId: problematicSlot.restaurantId,
                            fromDate: day,
                            toDate: bestDay,
                            fromTime: problematicSlot.time
                        });
                    }
                }
            }
        }

        if (reorganizations.length === 0) {
            return {
                success: true,
                message: 'Sua agenda já está otimizada! Nenhuma mudança necessária.',
                reorganizations: []
            };
        }

        // Aplicar as reorganizações
        const result = await applyScheduleReorganization(sellerId, reorganizations);

        return result;
    } catch (error) {
        console.error('Erro na otimização automática:', error);
        return { success: false, error: 'Erro ao otimizar agenda' };
    }
}

// Exportar agenda semanal para Excel profissional
export async function exportWeeklyScheduleToExcel(
    sellerId: string,
    weekStart: string
) {
    'use server';

    try {
        console.log('Iniciando exportação Excel...', { sellerId, weekStart });

        // Audit Log
        const token = cookies().get('session_token')?.value;
        if (token) {
            const user = await validateSession(token);
            if (user) {
                await logSystemActivity(user.id, 'EXPORT_EXCEL', { sellerId, weekStart, type: 'WeeklySchedule' }, 'Carteira', sellerId);
            }
        }

        const weekStartDate = new Date(weekStart);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 7);

        // Buscar dados do vendedor (query simples)
        const seller = await prisma.seller.findUnique({
            where: { id: sellerId },
        });

        if (!seller) {
            console.error('Vendedor não encontrado:', sellerId);
            return { success: false, error: 'Vendedor não encontrado' };
        }

        console.log('Vendedor encontrado:', seller.name);

        // Buscar restaurantes da carteira do vendedor
        const restaurantsRaw = await prisma.restaurant.findMany({
            where: {
                sellerId: sellerId,
            },
        });

        // Montar restaurantes (endereço já está no campo JSON)
        const restaurants = restaurantsRaw.map(r => ({
            id: r.id,
            name: r.name,
            salesPotential: r.salesPotential,
            rating: r.rating ? Number(r.rating) : 0,
            status: r.status,
            projectedDeliveries: r.projectedDeliveries || 0,
            reviewCount: r.reviewCount || 0,
            address: r.address as any, // JSON field
        }));

        console.log('Restaurantes encontrados:', restaurants.length);

        // Obter IDs dos restaurantes do vendedor
        const restaurantIds = restaurants.map(r => r.id);

        // Buscar follow-ups da semana (query simples)
        const followUpsRaw = await prisma.followUp.findMany({
            where: {
                scheduledDate: {
                    gte: weekStartDate,
                    lt: weekEndDate,
                },
                restaurantId: { in: restaurantIds },
            },
            orderBy: {
                scheduledDate: 'asc',
            },
        });

        // Montar follow-ups com restaurantes
        const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
        const followUps = followUpsRaw.map(f => ({
            ...f,
            restaurant: restaurantMap.get(f.restaurantId) || {
                id: f.restaurantId,
                name: 'Desconhecido',
                salesPotential: null,
                rating: 0,
                status: 'unknown',
                projectedDeliveries: 0,
                reviewCount: 0,
                address: null,
            },
        }));

        console.log('Follow-ups encontrados:', followUps.length);

        console.log('Preparando dados para Excel...');

        // Importar o serviço de exportação Excel
        const { createWeeklyScheduleExcel } = await import('@/lib/excel-export-service');

        // Preparar dados
        const data = {
            seller: {
                id: seller.id,
                name: seller.name,
                email: seller.email || '',
                regions: (seller.regions as string[]) || [],
                neighborhoods: (seller.neighborhoods as string[]) || [],
            },
            weekStart: weekStartDate,
            followUps: followUps.map(f => ({
                id: f.id,
                scheduledDate: f.scheduledDate,
                completed: f.completed || false,
                notes: f.notes,
                restaurant: {
                    id: f.restaurant.id,
                    name: f.restaurant.name,
                    address: f.restaurant.address || { street: null, neighborhood: null, city: null, state: null },
                    salesPotential: f.restaurant.salesPotential,
                    rating: f.restaurant.rating ? Number(f.restaurant.rating) : 0,
                    status: f.restaurant.status,
                    projectedDeliveries: f.restaurant.projectedDeliveries || 0,
                    reviewCount: f.restaurant.reviewCount || 0,
                },
            })),
            restaurants: restaurants,
            stats: {
                totalScheduled: followUps.length,
                pending: followUps.filter(f => !f.completed).length,
                completed: followUps.filter(f => f.completed).length,
                // Calcular outras estatísticas conforme necessário
                byStatus: {},
                byPotential: {}
            }
        };

        const result = await createWeeklyScheduleExcel(data);

        return {
            success: true,
            data: result.buffer.toString('base64'),
            filename: result.filename
        };
    } catch (error: any) {
        console.error('Erro ao exportar para Excel:', error);
        return { success: false, error: error.message || 'Erro ao exportar para Excel' };
    }
}

// Exportar agenda para template de agendamento (similar ao Excel mas com formato específico)
// Exportar agenda para template de agendamento (CheckMob)
export async function exportWeeklyScheduleToAgendamentoTemplate(
    sellerId: string,
    weekStart: string
) {
    'use server';

    try {
        console.log('Iniciando exportação para Template Agendamento CheckMob...', { sellerId, weekStart });

        // Audit Log
        const token = cookies().get('session_token')?.value;
        if (token) {
            const user = await validateSession(token);
            if (user) {
                await logSystemActivity(user.id, 'EXPORT_CHECKMOB', { sellerId, weekStart, type: 'AgendamentoTemplate' }, 'Carteira', sellerId);
            }
        }

        const weekStartDate = new Date(weekStart);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 7);

        // Buscar dados do vendedor
        const seller = await prisma.seller.findUnique({
            where: { id: sellerId },
        });

        if (!seller) {
            return { success: false, error: 'Vendedor não encontrado' };
        }

        // Buscar restaurantes da carteira do vendedor
        const restaurantsRaw = await prisma.restaurant.findMany({
            where: {
                sellerId: sellerId,
            },
        });

        // Montar restaurantes
        const restaurants = restaurantsRaw.map(r => ({
            id: r.id,
            name: r.name,
            salesPotential: r.salesPotential,
            rating: r.rating ? Number(r.rating) : 0,
            status: r.status,
            projectedDeliveries: r.projectedDeliveries || 0,
            reviewCount: r.reviewCount || 0,
            address: r.address as any,
        }));

        // Obter IDs dos restaurantes
        const restaurantIds = restaurants.map(r => r.id);

        // Buscar follow-ups da semana
        const followUpsRaw = await prisma.followUp.findMany({
            where: {
                scheduledDate: {
                    gte: weekStartDate,
                    lt: weekEndDate,
                },
                restaurantId: { in: restaurantIds },
            },
            orderBy: {
                scheduledDate: 'asc',
            },
        });

        // Montar follow-ups com restaurantes
        const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
        const followUps = followUpsRaw.map(f => ({
            ...f,
            restaurant: restaurantMap.get(f.restaurantId) || {
                id: f.restaurantId,
                name: 'Desconhecido',
                salesPotential: null,
                rating: 0,
                status: 'unknown',
                projectedDeliveries: 0,
                reviewCount: 0,
                address: null,
            },
        }));

        // Importar o serviço de exportação
        const { fillAgendamentoTemplate } = await import('@/lib/excel-export-service');

        // Preparar dados
        const data = {
            seller: {
                id: seller.id,
                name: seller.name,
                email: seller.email || '',
                regions: (seller.regions as string[]) || [],
                neighborhoods: (seller.neighborhoods as string[]) || [],
            },
            weekStart: weekStartDate,
            followUps: followUps.map(f => ({
                id: f.id,
                scheduledDate: f.scheduledDate,
                completed: f.completed || false,
                notes: f.notes,
                restaurant: {
                    id: f.restaurant.id,
                    name: f.restaurant.name,
                    address: f.restaurant.address || { street: null, neighborhood: null, city: null, state: null },
                    salesPotential: f.restaurant.salesPotential,
                    rating: f.restaurant.rating ? Number(f.restaurant.rating) : 0,
                    status: f.restaurant.status,
                    projectedDeliveries: f.restaurant.projectedDeliveries || 0,
                    reviewCount: f.restaurant.reviewCount || 0,
                },
            })),
            restaurants: restaurants,
            // Stats não são necessários para esse template, mas passamos para manter tipagem se precisar
            stats: {
                totalScheduled: followUps.length,
                pending: 0,
                completed: 0,
                byStatus: {},
                byPotential: {}
            }
        };

        const result = await fillAgendamentoTemplate(data);

        const filename = `Agendamento_CheckMob_${data.seller.name.replace(/\s+/g, '_')}_${weekStartDate.toISOString().split('T')[0]}.xlsx`;

        return {
            success: true,
            data: result.toString('base64'),
            filename: filename
        };
    } catch (error: any) {
        console.error('Erro ao exportar para template:', error);
        return { success: false, error: error.message || 'Erro ao exportar para template' };
    }
}

// --- GERENCIAMENTO DE CLIENTES FIXOS ---

// Obter clientes fixos do vendedor
export async function getFixedClients(sellerId: string) {
    try {
        const fixedClients = await prisma.fixedClient.findMany({
            where: { sellerId, active: true },
            include: { restaurant: true },
            orderBy: { createdAt: 'desc' }
        });
        return fixedClients;
    } catch (error) {
        console.error('Erro ao buscar clientes fixos:', error);
        return [];
    }
}

// Criar cliente fixo
export async function createFixedClient(data: {
    sellerId: string;
    restaurantId?: string;
    clientName?: string;
    clientAddress?: any;
    recurrenceType: string;
    monthlyDays: number[];
    weeklyDays: number[];
    radiusKm: number;
}) {
    try {
        await prisma.fixedClient.create({
            data: {
                sellerId: data.sellerId,
                restaurantId: data.restaurantId || null,
                clientName: data.clientName || null,
                clientAddress: data.clientAddress ? JSON.stringify(data.clientAddress) : null,
                recurrenceType: data.recurrenceType,
                monthlyDays: data.monthlyDays,
                weeklyDays: data.weeklyDays,
                radiusKm: data.radiusKm,
                active: true
            }
        });

        revalidatePath('/carteira');
        return { success: true };
    } catch (error: any) {
        console.error('Erro ao criar cliente fixo:', error);
        return { success: false, error: error.message || 'Erro ao criar cliente fixo' };
    }
}

// Atualizar cliente fixo
export async function updateFixedClient(id: string, data: {
    recurrenceType: string;
    monthlyDays: number[];
    weeklyDays: number[];
    radiusKm: number;
}) {
    try {
        await prisma.fixedClient.update({
            where: { id },
            data: {
                recurrenceType: data.recurrenceType,
                monthlyDays: data.monthlyDays,
                weeklyDays: data.weeklyDays,
                radiusKm: data.radiusKm
            }
        });

        revalidatePath('/carteira');
        return { success: true };
    } catch (error: any) {
        console.error('Erro ao atualizar cliente fixo:', error);
        return { success: false, error: error.message || 'Erro ao atualizar cliente fixo' };
    }
}

// Deletar cliente fixo
export async function deleteFixedClient(id: string) {
    try {
        await prisma.fixedClient.delete({
            where: { id }
        });

        revalidatePath('/carteira');
        return { success: true };
    } catch (error: any) {
        console.error('Erro ao deletar cliente fixo:', error);
        return { success: false, error: error.message || 'Erro ao deletar cliente fixo' };
    }
}



