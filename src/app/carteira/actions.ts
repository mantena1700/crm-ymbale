'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { generateIntelligentWeeklySchedule } from './actions-intelligent';
import { calculateDistance, getCoordinatesFromAddress } from '@/lib/distance-calculator';
import { getCoordinatesFromAddressWithGoogle, calculateBatchDistances, geocodeAddress } from '@/lib/google-maps';

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
            }
        });

        // Criar registro de visita
        try {
            await prisma.visit.create({
                data: {
                    restaurantId: followUp.restaurantId,
                    sellerId: '', // Seria preenchido com o vendedor logado
                    visitDate: new Date(),
                    feedback,
                    outcome
                }
            });
        } catch (e) {
            console.log('Tabela visits não existe');
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
export async function autoFillWeeklySchedule(
    sellerId: string,
    restaurants: any[],
    weekStart: string
) {
    try {
        console.log('🚀 Iniciando preenchimento automático...');
        console.log(`📊 Seller ID: ${sellerId}`);
        console.log(`📊 Restaurantes recebidos: ${restaurants.length}`);
        console.log(`📊 Semana: ${weekStart}`);

        if (!sellerId) {
            return { success: false, error: 'ID do vendedor não informado' };
        }

        if (!restaurants || restaurants.length === 0) {
            return { success: false, error: 'Nenhum restaurante disponível para agendar' };
        }

        const weekStartDate = new Date(weekStart);
        
        // Garantir que a data é válida
        if (isNaN(weekStartDate.getTime())) {
            return { success: false, error: 'Data de início da semana inválida' };
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
        
        const schedule = await generateIntelligentWeeklySchedule(
            restaurants,
            sellerId,
            weekStartDate,
            existingSchedule
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
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
            restaurants: restaurants.map(r => ({
                id: r.id,
                name: r.name,
                address: r.address || { street: null, neighborhood: null, city: null, state: null },
                salesPotential: r.salesPotential,
                rating: r.rating ? Number(r.rating) : 0,
                status: r.status,
                projectedDeliveries: r.projectedDeliveries || 0,
                reviewCount: r.reviewCount || 0,
            })),
        };

        // Gerar planilha
        console.log('Chamando createWeeklyScheduleExcel...');
        let buffer;
        try {
            buffer = await createWeeklyScheduleExcel(data);
            console.log('Excel gerado com sucesso, tamanho:', buffer.length);
        } catch (excelError) {
            console.error('Erro ao gerar Excel:', excelError);
            throw new Error(`Falha ao gerar planilha: ${excelError instanceof Error ? excelError.message : 'Erro desconhecido'}`);
        }

        // Converter buffer para base64 para enviar ao cliente
        const base64 = buffer.toString('base64');
        console.log('Conversão para base64 completa');

        return {
            success: true,
            data: base64,
            filename: `Agenda_${seller.name.replace(/\s/g, '_')}_${weekStartDate.toISOString().split('T')[0]}.xlsx`,
        };
    } catch (error) {
        console.error('Erro ao exportar agenda para Excel:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao exportar planilha',
        };
    }
}

// Exportar agenda semanal para template de agendamento
export async function exportWeeklyScheduleToAgendamentoTemplate(
    sellerId: string,
    weekStart: string
): Promise<{ success: boolean; data?: string; filename?: string; error?: string; count?: number }> {
    'use server';
    
    try {
        const ExcelJS = await import('exceljs');
        const fs = await import('fs');
        const path = await import('path');
        const { prisma } = await import('@/lib/db');
        
        // Caminhos possíveis do template
        const possiblePaths = [
            path.resolve(process.cwd(), 'template_agendamento.xlsx'),
            path.resolve(process.cwd(), '..', 'template_agendamento.xlsx'),
            path.join(process.cwd(), 'template_agendamento.xlsx'),
            'C:\\Users\\Bel\\Documents\\CRM_Ymbale\\crm-ymbale\\template_agendamento.xlsx',
        ];
        
        let finalTemplatePath = '';
        let triedPaths: string[] = [];
        
        for (const templatePath of possiblePaths) {
            triedPaths.push(templatePath);
            try {
                const normalizedPath = path.resolve(templatePath);
                if (fs.existsSync(normalizedPath)) {
                    finalTemplatePath = normalizedPath;
                    console.log(`✅ Template encontrado em: ${normalizedPath}`);
                    break;
                }
            } catch (error: any) {
                continue;
            }
        }
        
        if (!finalTemplatePath || !fs.existsSync(finalTemplatePath)) {
            const errorMsg = `Template não encontrado.\n\nCaminhos tentados:\n${triedPaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
            console.error('❌ Erro:', errorMsg);
            throw new Error(errorMsg);
        }
        
        // Buscar dados da agenda semanal
        const startDate = new Date(weekStart);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        endDate.setHours(23, 59, 59, 999);
        
        console.log(`\n📅 Buscando agendamentos da semana:`);
        console.log(`   Seller ID: ${sellerId}`);
        console.log(`   Data início: ${startDate.toISOString()}`);
        console.log(`   Data fim: ${endDate.toISOString()}`);
        
        // Buscar follow-ups da semana
        const followUps = await prisma.followUp.findMany({
            where: {
                scheduledDate: {
                    gte: startDate,
                    lte: endDate
                },
                completed: false,
                restaurant: {
                    sellerId: sellerId
                }
            },
            include: {
                restaurant: {
                    include: {
                        seller: {
                            select: {
                                name: true
                            }
                        }
                    },
                    // Incluir codigoCliente se o campo existir
                    select: undefined // Usar select undefined para incluir todos os campos
                }
            },
            orderBy: {
                scheduledDate: 'asc'
            }
        });
        
        console.log(`📊 Encontrados ${followUps.length} agendamentos para exportar`);
        
        // Carregar template
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(finalTemplatePath);
        
        // Obter planilha "Registros"
        let worksheet = workbook.getWorksheet('Registros');
        if (!worksheet) {
            // Se não encontrar, usar primeira planilha
            worksheet = workbook.getWorksheet(1);
        }
        
        if (!worksheet) {
            throw new Error('Planilha não encontrada no template');
        }
        
        // Encontrar linha de cabeçalho
        let headerRow = 1;
        const firstRow = worksheet.getRow(1);
        const firstRowValues = firstRow.values as any[];
        
        console.log(`\n📋 Mapeando colunas do template de agendamento...`);
        console.log(`   Valores do cabeçalho:`, firstRowValues.map((v, i) => `[${i}]: "${v}"`).join(', '));
        
        // Mapear colunas
        const columnMap: { [key: string]: number } = {};
        firstRowValues.forEach((value, index) => {
            if (value && typeof value === 'string') {
                const normalizedValue = value.trim().toLowerCase();
                if (normalizedValue.includes('código cliente') || normalizedValue.includes('codigo cliente')) {
                    columnMap['Código Cliente'] = index;
                    console.log(`   ✅ Coluna "Código Cliente" encontrada na coluna ${index}`);
                } else if (normalizedValue.includes('cliente') && !normalizedValue.includes('código') && !normalizedValue.includes('codigo')) {
                    columnMap['Cliente'] = index;
                    console.log(`   ✅ Coluna "Cliente" encontrada na coluna ${index}`);
                } else if (normalizedValue.includes('segmento')) {
                    columnMap['Segmento'] = index;
                } else if (normalizedValue.includes('contato')) {
                    columnMap['Contato'] = index;
                } else if (normalizedValue.includes('data prevista de início') || normalizedValue.includes('data prevista de inicio')) {
                    columnMap['Data Início'] = index;
                } else if (normalizedValue.includes('hora prevista de início') || normalizedValue.includes('hora prevista de inicio')) {
                    columnMap['Hora Início'] = index;
                } else if (normalizedValue.includes('data esperada de conclusão') || normalizedValue.includes('data esperada de conclusao')) {
                    columnMap['Data Conclusão'] = index;
                } else if (normalizedValue.includes('hora prevista de conclusão') || normalizedValue.includes('hora prevista de conclusao')) {
                    columnMap['Hora Conclusão'] = index;
                } else if (normalizedValue.includes('objetivo')) {
                    columnMap['Objetivo'] = index;
                } else if (normalizedValue.includes('equipe')) {
                    columnMap['Equipe'] = index;
                } else if (normalizedValue.includes('nome do usuário') || normalizedValue.includes('nome do usuario')) {
                    columnMap['Nome Usuário'] = index;
                } else if (normalizedValue.includes('ativo')) {
                    columnMap['Ativo'] = index;
                }
            }
        });
        
        console.log(`\n📊 Colunas mapeadas:`, Object.keys(columnMap).map(k => `${k}: coluna ${columnMap[k]}`).join(', '));
        
        // Remover dados de exemplo (linhas 2 em diante)
        const lastRow = worksheet.rowCount;
        if (lastRow > headerRow) {
            const rowsToDelete = lastRow - headerRow;
            worksheet.spliceRows(headerRow + 1, rowsToDelete);
        }
        
        // Preencher com dados reais
        console.log(`\n📝 Preenchendo ${followUps.length} agendamentos...`);
        followUps.forEach((followUp, index) => {
            const targetRowNumber = headerRow + 1 + index;
            const newRow = worksheet.getRow(targetRowNumber);
            
            const scheduledDate = new Date(followUp.scheduledDate);
            
            // Criar data apenas (sem horário) para exportação
            // Usar meio-dia como hora padrão para evitar problemas de timezone
            const dateOnly = new Date(scheduledDate);
            dateOnly.setHours(12, 0, 0, 0); // Meio-dia para garantir que a data seja preservada
            
            // Preencher campos
            if (columnMap['Código Cliente'] !== undefined) {
                // Tentar acessar codigoCliente de diferentes formas
                const codigoCliente = (followUp.restaurant as any).codigoCliente || 
                                     (followUp.restaurant as any).codigo_cliente || 
                                     '';
                newRow.getCell(columnMap['Código Cliente']).value = codigoCliente ? String(codigoCliente) : '';
                if (index < 5) {
                    console.log(`   [${index + 1}] Código Cliente: ${codigoCliente || 'N/A'}`);
                }
            }
            if (columnMap['Cliente'] !== undefined) {
                newRow.getCell(columnMap['Cliente']).value = followUp.restaurant.name || '';
            }
            if (columnMap['Segmento'] !== undefined) {
                // Sempre preencher com "Carteira Sul"
                newRow.getCell(columnMap['Segmento']).value = 'Carteira Sul';
            }
            if (columnMap['Contato'] !== undefined) {
                newRow.getCell(columnMap['Contato']).value = ''; // Deixar vazio ou buscar do banco
            }
            if (columnMap['Data Início'] !== undefined) {
                // Preencher apenas com a data (sem horário visível)
                newRow.getCell(columnMap['Data Início']).value = dateOnly;
            }
            if (columnMap['Hora Início'] !== undefined) {
                // Deixar em branco
                newRow.getCell(columnMap['Hora Início']).value = '';
            }
            if (columnMap['Data Conclusão'] !== undefined) {
                // Usar a mesma data de início (sem horário)
                newRow.getCell(columnMap['Data Conclusão']).value = dateOnly;
            }
            if (columnMap['Hora Conclusão'] !== undefined) {
                // Deixar em branco
                newRow.getCell(columnMap['Hora Conclusão']).value = '';
            }
            if (columnMap['Objetivo'] !== undefined) {
                // Sempre "Prospecção de Clientes"
                newRow.getCell(columnMap['Objetivo']).value = 'Prospecção de Clientes';
            }
            if (columnMap['Equipe'] !== undefined) {
                // Sempre "REGIÃO 4 - Sudeste - José Rampin (Gerente)"
                newRow.getCell(columnMap['Equipe']).value = 'REGIÃO 4 - Sudeste - José Rampin (Gerente)';
            }
            if (columnMap['Nome Usuário'] !== undefined) {
                newRow.getCell(columnMap['Nome Usuário']).value = followUp.restaurant.seller?.name || '';
            }
            if (columnMap['Ativo'] !== undefined) {
                newRow.getCell(columnMap['Ativo']).value = 'Sim';
            }
            
            if (index < 5) {
                console.log(`   [${index + 1}] ${followUp.restaurant.name} - ${scheduledDate.toLocaleString('pt-BR')}`);
            }
        });
        
        // Converter para buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Converter para base64
        const base64 = Buffer.from(buffer).toString('base64');
        
        const weekStartFormatted = new Date(weekStart).toLocaleDateString('pt-BR').replace(/\//g, '-');
        
        return {
            success: true,
            data: base64,
            filename: `Agendamento_Semanal_${weekStartFormatted}.xlsx`,
            count: followUps.length
        };
    } catch (error: any) {
        console.error('Erro ao exportar agenda semanal:', error);
        return {
            success: false,
            error: error.message || 'Erro ao exportar agenda semanal'
        };
    }
}

// ========================================
// CLIENTES FIXOS (Fixed Clients)
// ========================================

// Buscar clientes fixos do executivo
export async function getFixedClients(sellerId: string) {
    'use server';
    
    try {
        // Verificar se a tabela existe usando query do catálogo PostgreSQL
        try {
            const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'fixed_clients'
                ) as exists
            `;
            
            if (!tableExists[0]?.exists) {
                console.log('Tabela fixed_clients ainda não existe, retornando vazio');
                return [];
            }
        } catch (error: any) {
            // Se der erro na verificação, assumir que não existe
            console.log('Erro ao verificar tabela fixed_clients, retornando vazio:', error.message);
            return [];
        }

        const fixedClients = await prisma.fixedClient.findMany({
            where: {
                sellerId: sellerId,
                active: true
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        return fixedClients.map(fc => ({
            id: fc.id,
            sellerId: fc.sellerId,
            restaurantId: fc.restaurantId,
            restaurant: fc.restaurant,
            clientName: fc.clientName,
            clientAddress: fc.clientAddress,
            recurrenceType: fc.recurrenceType,
            monthlyDays: Array.isArray(fc.monthlyDays) ? fc.monthlyDays : (typeof fc.monthlyDays === 'string' ? JSON.parse(fc.monthlyDays) : []),
            weeklyDays: Array.isArray(fc.weeklyDays) ? fc.weeklyDays : (typeof fc.weeklyDays === 'string' ? JSON.parse(fc.weeklyDays) : []),
            radiusKm: fc.radiusKm ? Number(fc.radiusKm) : 15.0, // Converter Decimal para number (padrão 15km)
            latitude: fc.latitude ? Number(fc.latitude) : null,
            longitude: fc.longitude ? Number(fc.longitude) : null,
            active: fc.active,
            createdAt: fc.createdAt,
            updatedAt: fc.updatedAt
        }));
    } catch (error: any) {
        console.error('Erro ao buscar clientes fixos:', error);
        return [];
    }
}

// Função auxiliar: Ajustar dias do mês que caem em finais de semana para o próximo dia útil
function adjustMonthlyDaysToWeekdays(monthlyDays: number[], year: number, month: number): number[] {
    const adjustedDays: number[] = [];
    
    monthlyDays.forEach(day => {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
        
        // Se for sábado (6) ou domingo (0), mover para segunda-feira
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            // Calcular quantos dias adicionar para chegar na segunda-feira
            const daysToAdd = dayOfWeek === 0 ? 1 : 2; // Domingo -> +1 dia, Sábado -> +2 dias
            const adjustedDate = new Date(date);
            adjustedDate.setDate(date.getDate() + daysToAdd);
            adjustedDays.push(adjustedDate.getDate());
        } else {
            adjustedDays.push(day);
        }
    });
    
    // Remover duplicatas e ordenar
    return [...new Set(adjustedDays)].sort((a, b) => a - b);
}

// Criar cliente fixo
export async function createFixedClient(data: {
    sellerId: string;
    restaurantId?: string;
    clientName?: string;
    clientAddress?: {
        street?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
        zip?: string;
    };
    recurrenceType: 'monthly_days' | 'weekly_days';
    monthlyDays?: number[];
    weeklyDays?: number[];
    radiusKm?: number;
}) {
    'use server';
    
    try {
        // Verificar e criar tabela se não existir
        try {
            const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'fixed_clients'
                ) as exists
            `;
            
            if (!tableExists[0]?.exists) {
                console.log('📄 Tabela fixed_clients não encontrada. Criando automaticamente...');
                
                // Criar tabela
                await prisma.$executeRaw`
                    CREATE TABLE IF NOT EXISTS fixed_clients (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
                        restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
                        client_name VARCHAR(255),
                        client_address JSONB,
                        recurrence_type VARCHAR(20) NOT NULL,
                        monthly_days JSONB DEFAULT '[]'::jsonb,
                        weekly_days JSONB DEFAULT '[]'::jsonb,
                        radius_km DECIMAL(5,2) DEFAULT 10.0,
                        active BOOLEAN DEFAULT true,
                        created_at TIMESTAMPTZ(6) DEFAULT NOW(),
                        updated_at TIMESTAMPTZ(6) DEFAULT NOW()
                    )
                `;
                
                // Criar índices
                await prisma.$executeRaw`
                    CREATE INDEX IF NOT EXISTS idx_fixed_clients_seller_id ON fixed_clients(seller_id)
                `;
                await prisma.$executeRaw`
                    CREATE INDEX IF NOT EXISTS idx_fixed_clients_restaurant_id ON fixed_clients(restaurant_id)
                `;
                await prisma.$executeRaw`
                    CREATE INDEX IF NOT EXISTS idx_fixed_clients_active ON fixed_clients(active) WHERE active = true
                `;
                
                // Criar função e trigger para updated_at
                await prisma.$executeRaw`
                    CREATE OR REPLACE FUNCTION update_fixed_clients_updated_at()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        NEW.updated_at = NOW();
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql
                `;
                
                await prisma.$executeRaw`
                    DROP TRIGGER IF EXISTS update_fixed_clients_updated_at ON fixed_clients
                `;
                
                await prisma.$executeRaw`
                    CREATE TRIGGER update_fixed_clients_updated_at
                        BEFORE UPDATE ON fixed_clients
                        FOR EACH ROW
                        EXECUTE FUNCTION update_fixed_clients_updated_at()
                `;
                
                console.log('✅ Tabela fixed_clients criada com sucesso!');
            }
        } catch (error: any) {
            console.error('Erro ao verificar/criar tabela fixed_clients:', error);
            // Tentar continuar mesmo se houver erro na verificação
        }

        // Validar dados
        if (!data.sellerId) {
            return { success: false, error: 'Executivo é obrigatório' };
        }
        
        // Deve ter restaurantId OU clientName (não vazio)
        const hasRestaurantId = data.restaurantId && data.restaurantId.trim() !== '';
        const hasClientName = data.clientName && data.clientName.trim() !== '';
        
        if (!hasRestaurantId && !hasClientName) {
            return { success: false, error: 'Selecione um restaurante da base OU cadastre um cliente manualmente' };
        }
        
        // Se for cliente manual, validar endereço
        if (hasClientName && !hasRestaurantId) {
            if (!data.clientAddress?.street || data.clientAddress.street.trim() === '') {
                return { success: false, error: 'Endereço (rua) é obrigatório para cliente manual' };
            }
            if (!data.clientAddress?.neighborhood || data.clientAddress.neighborhood.trim() === '') {
                return { success: false, error: 'Bairro é obrigatório para cliente manual' };
            }
            if (!data.clientAddress?.city || data.clientAddress.city.trim() === '') {
                return { success: false, error: 'Cidade é obrigatória para cliente manual' };
            }
            if (!data.clientAddress?.state || data.clientAddress.state.trim() === '') {
                return { success: false, error: 'Estado é obrigatório para cliente manual' };
            }
        }
        
        if (data.recurrenceType === 'monthly_days' && (!data.monthlyDays || data.monthlyDays.length === 0)) {
            return { success: false, error: 'Dias do mês são obrigatórios para recorrência mensal' };
        }
        
        if (data.recurrenceType === 'weekly_days' && (!data.weeklyDays || data.weeklyDays.length === 0)) {
            return { success: false, error: 'Dias da semana são obrigatórios para recorrência semanal' };
        }
        
        // Ajustar dias do mês que caem em finais de semana
        let adjustedMonthlyDays = data.monthlyDays || [];
        if (data.recurrenceType === 'monthly_days' && adjustedMonthlyDays.length > 0) {
            const now = new Date();
            adjustedMonthlyDays = adjustMonthlyDaysToWeekdays(adjustedMonthlyDays, now.getFullYear(), now.getMonth() + 1);
        }
        
        // Construir objeto de dados dinamicamente (não enviar null explicitamente)
        const createData: any = {
            sellerId: data.sellerId,
            recurrenceType: data.recurrenceType,
            monthlyDays: adjustedMonthlyDays,
            weeklyDays: data.weeklyDays ? data.weeklyDays : [],
            radiusKm: data.radiusKm || 15.0, // Padrão aumentado para 15km
            active: true
        };
        
        // Adicionar restaurantId apenas se fornecido
        if (hasRestaurantId && data.restaurantId) {
            createData.restaurantId = data.restaurantId;
        }
        
        // Adicionar clientName e clientAddress apenas se for cliente manual
        if (hasClientName && !hasRestaurantId) {
            createData.clientName = data.clientName.trim();
            if (data.clientAddress) {
                createData.clientAddress = data.clientAddress;
            }
        }
        
        const fixedClient = await prisma.fixedClient.create({
            data: createData,
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            }
        });
        
        // Converter Decimal para number antes de retornar
        const serializedFixedClient = {
            ...fixedClient,
            radiusKm: fixedClient.radiusKm ? Number(fixedClient.radiusKm) : 15.0,
            latitude: fixedClient.latitude ? Number(fixedClient.latitude) : null,
            longitude: fixedClient.longitude ? Number(fixedClient.longitude) : null
        };
        
        return { success: true, data: serializedFixedClient };
    } catch (error: any) {
        console.error('Erro ao criar cliente fixo:', error);
        return { success: false, error: error.message || 'Erro ao criar cliente fixo' };
    }
}

// Atualizar cliente fixo
export async function updateFixedClient(
    id: string,
    data: {
        recurrenceType?: 'monthly_days' | 'weekly_days';
        monthlyDays?: number[];
        weeklyDays?: number[];
        radiusKm?: number;
        active?: boolean;
    }
) {
    'use server';
    
    try {
        // Verificar se a tabela existe usando query do catálogo PostgreSQL
        try {
            const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'fixed_clients'
                ) as exists
            `;
            
            if (!tableExists[0]?.exists) {
                console.error('Tabela fixed_clients não encontrada no banco de dados');
                return { success: false, error: 'Tabela de clientes fixos ainda não foi criada. Execute o SQL: docker exec -i crm-postgres psql -U crm_user -d crm_ymbale < scripts/create-fixed-clients-table.sql' };
            }
        } catch (error: any) {
            console.error('Erro ao verificar tabela fixed_clients:', error);
            return { success: false, error: `Erro ao verificar tabela: ${error.message}. Execute o SQL primeiro.` };
        }

        // Ajustar dias do mês que caem em finais de semana
        let adjustedMonthlyDays = data.monthlyDays;
        if (data.recurrenceType === 'monthly_days' && adjustedMonthlyDays && adjustedMonthlyDays.length > 0) {
            const now = new Date();
            adjustedMonthlyDays = adjustMonthlyDaysToWeekdays(adjustedMonthlyDays, now.getFullYear(), now.getMonth() + 1);
        }

        const fixedClient = await prisma.fixedClient.update({
            where: { id },
            data: {
                ...(data.recurrenceType && { recurrenceType: data.recurrenceType }),
                ...(adjustedMonthlyDays !== undefined && { monthlyDays: adjustedMonthlyDays }),
                ...(data.weeklyDays !== undefined && { weeklyDays: data.weeklyDays }),
                ...(data.radiusKm !== undefined && { radiusKm: data.radiusKm }),
                ...(data.active !== undefined && { active: data.active })
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            }
        });
        
        // Converter Decimal para number antes de retornar
        const serializedFixedClient = {
            ...fixedClient,
            radiusKm: fixedClient.radiusKm ? Number(fixedClient.radiusKm) : 15.0,
            latitude: fixedClient.latitude ? Number(fixedClient.latitude) : null,
            longitude: fixedClient.longitude ? Number(fixedClient.longitude) : null
        };
        
        return { success: true, data: serializedFixedClient };
    } catch (error: any) {
        console.error('Erro ao atualizar cliente fixo:', error);
        return { success: false, error: error.message || 'Erro ao atualizar cliente fixo' };
    }
}

// Deletar cliente fixo
export async function deleteFixedClient(id: string) {
    'use server';
    
    try {
        await prisma.fixedClient.delete({
            where: { id }
        });
        
        return { success: true };
    } catch (error: any) {
        console.error('Erro ao deletar cliente fixo:', error);
        return { success: false, error: error.message || 'Erro ao deletar cliente fixo' };
    }
}

// Obter clientes fixos agendados para a semana
export async function getFixedClientsForWeek(sellerId: string, weekStart: string) {
    'use server';
    
    try {
        // Verificar se a tabela existe usando query do catálogo PostgreSQL
        try {
            const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'fixed_clients'
                ) as exists
            `;
            
            if (!tableExists[0]?.exists) {
                console.log('Tabela fixed_clients ainda não existe, retornando vazio');
                return {};
            }
        } catch (error: any) {
            // Se der erro na verificação, assumir que não existe
            console.log('Erro ao verificar tabela fixed_clients, retornando vazio:', error.message);
            return {};
        }

        const startDate = new Date(weekStart);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        
        // Buscar todos os clientes fixos do executivo
        const fixedClients = await prisma.fixedClient.findMany({
            where: {
                sellerId: sellerId,
                active: true
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            }
        });
        
        // Calcular quais dias da semana têm clientes fixos
        const fixedClientsByDay: { [date: string]: Array<{
            id: string;
            restaurantId: string | null;
            restaurantName: string;
            restaurantAddress: any;
            radiusKm: number;
            latitude: number | null;
            longitude: number | null;
        }> } = {};
        
        console.log(`\n🔍 Buscando clientes fixos para a semana começando em ${startDate.toISOString().split('T')[0]}`);
        console.log(`📋 Total de clientes fixos ativos: ${fixedClients.length}`);
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, etc.
            const dayOfMonth = date.getDate();
            const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek];
            
            fixedClientsByDay[dateString] = [];
            
            fixedClients.forEach(fc => {
                let shouldInclude = false;
                
                if (fc.recurrenceType === 'weekly_days') {
                    const weeklyDays = Array.isArray(fc.weeklyDays) ? fc.weeklyDays : (typeof fc.weeklyDays === 'string' ? JSON.parse(fc.weeklyDays) : []);
                    if (weeklyDays.includes(dayOfWeek)) {
                        shouldInclude = true;
                        console.log(`   ✅ ${dayName} (${dateString}): Cliente fixo "${fc.restaurant?.name || fc.clientName}" corresponde (dias semanais: ${JSON.stringify(weeklyDays)})`);
                    }
                } else if (fc.recurrenceType === 'monthly_days') {
                    const monthlyDays = Array.isArray(fc.monthlyDays) ? fc.monthlyDays : (typeof fc.monthlyDays === 'string' ? JSON.parse(fc.monthlyDays) : []);
                    // Ajustar dias do mês para o próximo dia útil se necessário
                    const adjustedDays = adjustMonthlyDaysToWeekdays(monthlyDays, date.getFullYear(), date.getMonth() + 1);
                    if (adjustedDays.includes(dayOfMonth)) {
                        shouldInclude = true;
                        console.log(`   ✅ ${dayName} (${dateString}): Cliente fixo "${fc.restaurant?.name || fc.clientName}" corresponde (dias mensais: ${JSON.stringify(monthlyDays)})`);
                    }
                }
                
                if (shouldInclude) {
                    // Usar dados do restaurante se existir, senão usar dados manuais
                    const clientName = fc.restaurant?.name || fc.clientName || 'Cliente Fixo';
                    const clientAddress = fc.restaurant?.address || fc.clientAddress || {};
                    
                    fixedClientsByDay[dateString].push({
                        id: fc.id,
                        restaurantId: fc.restaurantId || '',
                        restaurantName: clientName,
                        restaurantAddress: clientAddress,
                        radiusKm: Number(fc.radiusKm),
                        latitude: fc.latitude ? Number(fc.latitude) : null,
                        longitude: fc.longitude ? Number(fc.longitude) : null
                    });
                }
            });
        }
        
        // Log final resumido
        console.log(`\n📊 Resumo de clientes fixos por dia:`);
        Object.keys(fixedClientsByDay).forEach(date => {
            const count = fixedClientsByDay[date].length;
            if (count > 0) {
                console.log(`   ${date}: ${count} cliente(s) fixo(s)`);
            }
        });
        
        return fixedClientsByDay;
    } catch (error: any) {
        console.error('Erro ao buscar clientes fixos da semana:', error);
        return {};
    }
}

// Buscar clientes de prospecção próximos a um cliente fixo usando distância geográfica real
// Função auxiliar (não é server action, pode ser chamada de outros server actions)
export async function findNearbyProspectClients(
    fixedClient: any,
    sellerId: string,
    maxResults: number = 7
): Promise<any[]> {
    try {
        console.log(`\n🔍 findNearbyProspectClients chamada:`);
        console.log(`   Cliente fixo: ${fixedClient.restaurantName || fixedClient.clientName}`);
        console.log(`   Seller ID: ${sellerId}`);
        console.log(`   Max results: ${maxResults}`);
        
        // Obter coordenadas do cliente fixo
        let fixedLat = fixedClient.latitude;
        let fixedLon = fixedClient.longitude;

        console.log(`   Coordenadas iniciais: ${fixedLat || 'N/A'}, ${fixedLon || 'N/A'}`);

        // Se não tiver coordenadas, calcular agora usando Google Maps API
        if (!fixedLat || !fixedLon) {
            console.log(`   ⚠️ Coordenadas não encontradas, calculando com Google Maps API...`);
            const address = fixedClient.restaurantAddress || fixedClient.clientAddress || fixedClient.address;
            console.log(`   Endereço usado: ${JSON.stringify(address)}`);
            
            // Usar Google Maps API para obter coordenadas precisas
            const coords = await getCoordinatesFromAddressWithGoogle(
                address,
                { latitude: fixedLat, longitude: fixedLon }
            );
            
            if (coords) {
                fixedLat = coords.latitude;
                fixedLon = coords.longitude;
                console.log(`   ✅ Coordenadas obtidas (Google Maps): ${fixedLat}, ${fixedLon}`);
                
                // Atualizar no banco para próximas vezes (se tiver ID)
                if (fixedClient.id) {
                    await prisma.fixedClient.update({
                        where: { id: fixedClient.id },
                        data: { latitude: fixedLat, longitude: fixedLon }
                    }).catch(() => {}); // Ignora erro se já foi atualizado
                }
            } else {
                console.warn(`   ❌ Cliente fixo ${fixedClient.clientName || fixedClient.restaurantName} não tem coordenadas válidas`);
                return [];
            }
        }

        // Buscar todos os restaurantes da carteira do executivo
        const allRestaurants = await prisma.restaurant.findMany({
            where: {
                sellerId: sellerId,
                status: {
                    notIn: ['Cliente', 'Perdido', 'Sem interesse', 'Descartado']
                }
            }
        });
        
        console.log(`   📊 Total de restaurantes na carteira: ${allRestaurants.length}`);

        // Primeiro, garantir que todos os restaurantes têm coordenadas
        console.log(`   🔄 Obtendo/atualizando coordenadas dos restaurantes...`);
        const restaurantsWithCoords = await Promise.all(
            allRestaurants.map(async (restaurant) => {
                let restLat = restaurant.latitude;
                let restLon = restaurant.longitude;

                // Se não tiver coordenadas, calcular agora usando Google Maps API
                if (!restLat || !restLon) {
                    const coords = await getCoordinatesFromAddressWithGoogle(
                        restaurant.address,
                        { latitude: restLat, longitude: restLon }
                    );
                    if (coords) {
                        restLat = coords.latitude;
                        restLon = coords.longitude;
                        
                        // Atualizar no banco
                        await prisma.restaurant.update({
                            where: { id: restaurant.id },
                            data: { latitude: restLat, longitude: restLon }
                        }).catch(() => {}); // Ignora erro se já foi atualizado
                    } else {
                        return null; // Pular restaurantes sem coordenadas
                    }
                }

                return {
                    ...restaurant,
                    latitude: restLat,
                    longitude: restLon
                };
            })
        );

        const validRestaurants = restaurantsWithCoords.filter((r): r is NonNullable<typeof r> => r !== null);
        console.log(`   ✅ ${validRestaurants.length} restaurantes com coordenadas válidas`);

        // Usar Google Maps Distance Matrix API para calcular distâncias reais em lote
        console.log(`   🗺️ Calculando distâncias reais com Google Maps API...`);
        const origin = { latitude: fixedLat!, longitude: fixedLon! };
        const destinations = validRestaurants.map(r => ({
            id: r.id,
            latitude: r.latitude!,
            longitude: r.longitude!
        }));

        const realDistances = await calculateBatchDistances(origin, destinations, 'driving');
        console.log(`   ✅ ${realDistances.filter(d => d.distanceKm !== Infinity).length} distâncias calculadas com sucesso`);

        // Criar mapa de distâncias por ID
        const distanceMap = new Map<string, { distanceKm: number; durationMinutes: number }>();
        realDistances.forEach(d => {
            if (d.distanceKm !== Infinity) {
                distanceMap.set(d.id, { distanceKm: d.distanceKm, durationMinutes: d.durationMinutes });
            }
        });

        // Calcular score e combinar com distâncias reais
        const restaurantsWithDistance = validRestaurants.map((restaurant) => {
            // Usar distância real da API se disponível, senão usar Haversine como fallback
            let distance: number;
            let durationMinutes: number | undefined;

            const realDistance = distanceMap.get(restaurant.id);
            if (realDistance) {
                distance = realDistance.distanceKm;
                durationMinutes = realDistance.durationMinutes;
            } else {
                // Fallback para Haversine se API falhar
                distance = calculateDistance(fixedLat!, fixedLon!, restaurant.latitude!, restaurant.longitude!);
                console.log(`   ⚠️ Usando distância Haversine para ${restaurant.name} (API falhou)`);
            }

            // Calcular score de prioridade
            let score = 0;
            
            // Potencial de vendas
            if (restaurant.salesPotential === 'ALTISSIMO') score += 100;
            else if (restaurant.salesPotential === 'ALTO') score += 75;
            else if (restaurant.salesPotential === 'MEDIO') score += 50;
            else if (restaurant.salesPotential === 'BAIXO') score += 25;
            
            // Rating e avaliações
            score += (Number(restaurant.rating) || 0) * 10;
            score += Math.min(Number(restaurant.reviewCount) || 0, 100) * 0.5;
            score += Math.min((Number(restaurant.projectedDeliveries) || 0) / 100, 50);
            
            // Penalizar clientes já em negociação
            if (restaurant.status === 'Contatado' || restaurant.status === 'Negociação') {
                score *= 0.7;
            }

            // BONUS POR PROXIMIDADE: quanto mais perto, maior o bonus
            // Usar tempo estimado se disponível (mais relevante que distância em linha reta)
            const proximityMetric = durationMinutes !== undefined ? durationMinutes / 10 : distance;
            const proximityBonus = Math.max(0, 50 - proximityMetric);
            score += proximityBonus;

            return {
                ...restaurant,
                distance,
                durationMinutes,
                score
            };
        });

        // Filtrar e ordenar restaurantes com algoritmo de clustering
        const radiusKm = fixedClient.radiusKm || 15.0; // Aumentado padrão de 10km para 15km
        
        console.log(`   🔍 Filtrando restaurantes no raio de ${radiusKm}km...`);
        
        // 1. Filtrar restaurantes dentro do raio (CRÍTICO: esta é a validação de proximidade)
        // Usar distância real da API se disponível, senão usar Haversine
        const restaurantsInRadius = restaurantsWithDistance
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .filter(r => {
                const dist = r.distance;
                const isWithinRadius = dist <= radiusKm;
                if (!isWithinRadius) {
                    console.log(`   ❌ ${r.name} está FORA do raio: ${dist.toFixed(2)}km > ${radiusKm}km`);
                }
                return isWithinRadius;
            });
        
        console.log(`   📍 Restaurantes dentro do raio de ${radiusKm}km: ${restaurantsInRadius.length}`);
        
        if (restaurantsInRadius.length === 0) {
            console.log(`   ⚠️ NENHUM restaurante encontrado no raio de ${radiusKm}km do cliente fixo!`);
            console.log(`   💡 Isso significa que não há restaurantes próximos suficientes para preencher este dia`);
            // Log dos restaurantes mais próximos (mesmo fora do raio)
            const sortedByDistance = restaurantsWithDistance
                .filter((r): r is NonNullable<typeof r> => r !== null)
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 5);
            if (sortedByDistance.length > 0) {
                console.log(`   📊 5 restaurantes mais próximos (mas FORA do raio de ${radiusKm}km):`);
                sortedByDistance.forEach((r, idx) => {
                    console.log(`      ${idx + 1}. ${r.name}: ${r.distance.toFixed(2)}km (${r.distance > radiusKm ? 'FORA' : 'DENTRO'} do raio)`);
                });
            }
            console.log(`   ✅ Retornando array vazio - este dia NÃO será preenchido com restaurantes distantes`);
            return [];
        }
        
        console.log(`   ✅ ${restaurantsInRadius.length} restaurantes VALIDADOS como próximos (dentro de ${radiusKm}km)`);
        
        // 2. Criar clusters de restaurantes próximos entre si (algoritmo de clustering simples)
        // Agrupar restaurantes que estão a menos de 5km uns dos outros
        const clusters: Array<Array<typeof restaurantsInRadius[0]>> = [];
        const assigned = new Set<string>();
        
        for (const restaurant of restaurantsInRadius) {
            if (assigned.has(restaurant.id)) continue;
            
            // Criar novo cluster começando com este restaurante
            const cluster: Array<typeof restaurantsInRadius[0]> = [restaurant];
            assigned.add(restaurant.id);
            
            // Encontrar todos os restaurantes próximos a este (dentro de 5km)
            for (const other of restaurantsInRadius) {
                if (assigned.has(other.id)) continue;
                
                const distanceBetween = calculateDistance(
                    restaurant.latitude!,
                    restaurant.longitude!,
                    other.latitude!,
                    other.longitude!
                );
                
                if (distanceBetween <= 5.0) {
                    cluster.push(other);
                    assigned.add(other.id);
                }
            }
            
            clusters.push(cluster);
        }
        
        // 3. Ordenar clusters por:
        //    - Distância média do cluster ao cliente fixo
        //    - Tamanho do cluster (clusters maiores têm prioridade)
        clusters.sort((a, b) => {
            const avgDistA = a.reduce((sum, r) => sum + r.distance, 0) / a.length;
            const avgDistB = b.reduce((sum, r) => sum + r.distance, 0) / b.length;
            
            // Se a diferença de distância média for < 3km, priorizar cluster maior
            if (Math.abs(avgDistA - avgDistB) < 3.0) {
                return b.length - a.length; // Cluster maior primeiro
            }
            
            return avgDistA - avgDistB; // Cluster mais próximo primeiro
        });
        
        // 4. Selecionar restaurantes dos melhores clusters
        const nearbyRestaurants: Array<typeof restaurantsInRadius[0] & { clusterId?: number; distanceFromFixed: number }> = [];
        let clusterId = 0;
        
        for (const cluster of clusters) {
            // Ordenar restaurantes dentro do cluster por distância + score
            cluster.sort((a, b) => {
                const distDiff = a.distance - b.distance;
                if (Math.abs(distDiff) < 3.0) {
                    return b.score - a.score;
                }
                return distDiff;
            });
            
            // Adicionar restaurantes do cluster com ID do cluster e distância
            for (const restaurant of cluster) {
                if (nearbyRestaurants.length >= maxResults) break;
                nearbyRestaurants.push({ 
                    ...restaurant, 
                    clusterId,
                    distanceFromFixed: restaurant.distance,
                    durationMinutes: restaurant.durationMinutes
                });
            }
            
            if (nearbyRestaurants.length >= maxResults) break;
            clusterId++;
        }
        
        // Limitar ao máximo solicitado
        const finalResults = nearbyRestaurants.slice(0, maxResults);

        // VALIDAÇÃO FINAL: Garantir que TODOS os restaurantes retornados estão dentro do raio
        const validatedResults = finalResults.filter(r => {
            const isValid = r.distanceFromFixed <= radiusKm;
            if (!isValid) {
                console.error(`   ❌ ERRO: ${r.name} está FORA do raio! ${r.distanceFromFixed.toFixed(2)}km > ${radiusKm}km`);
            }
            return isValid;
        });

        // Log detalhado para debug
        console.log('\n=== PREENCHIMENTO INTELIGENTE ===');
        console.log(`📍 Cliente Fixo: ${fixedClient.clientName || fixedClient.restaurantName}`);
        const addressStr = fixedClient.restaurantAddress 
            ? JSON.stringify(fixedClient.restaurantAddress).substring(0, 100)
            : 'Endereço não disponível';
        console.log(`   Endereço: ${addressStr}`);
        console.log(`   Coordenadas: ${fixedLat!.toFixed(4)}, ${fixedLon!.toFixed(4)}`);
        console.log(`   Raio de busca: ${radiusKm}km`);
        console.log(`   Restaurantes encontrados no raio: ${restaurantsInRadius.length}`);
        console.log(`   Clusters criados: ${clusters.length}`);
        console.log(`   Restaurantes selecionados: ${validatedResults.length}`);
        
        if (validatedResults.length > 0) {
            console.log('\n   ✅ Restaurantes VALIDADOS como próximos:');
            validatedResults.slice(0, 5).forEach((r, i) => {
                const clusterInfo = r.clusterId !== undefined ? ` (Cluster ${r.clusterId})` : '';
                const timeInfo = r.durationMinutes ? ` | ⏱️ ${r.durationMinutes}min` : '';
                const distanceStatus = r.distanceFromFixed <= radiusKm ? '✅ DENTRO' : '❌ FORA';
                console.log(`   ${i + 1}. ${r.name}${clusterInfo}`);
                console.log(`      📏 ${r.distanceFromFixed.toFixed(2)}km do cliente fixo ${distanceStatus}${timeInfo} | 📊 Score: ${r.score.toFixed(0)}`);
            });
        } else {
            console.log('   ⚠️ Nenhum restaurante encontrado no raio especificado');
        }
        console.log('================================\n');

        return validatedResults;
    } catch (error) {
        console.error('❌ Erro ao buscar clientes próximos:', error);
        return [];
    }
}

