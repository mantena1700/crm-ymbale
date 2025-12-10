// src/lib/db-data.ts
// Camada de dados usando Prisma para buscar do banco de dados
import { prisma } from './db';
import { Restaurant, AnalysisResult, Note, FollowUp, Goal, Activity, Seller } from './types';

// Helper para verificar se estamos em build time
const isBuildTime = () => {
    return process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.includes('postgres:');
};

// Restaurantes
export async function getRestaurants(): Promise<Restaurant[]> {
    try {
        // Buscar zonas primeiro para mapear
        const zonasMap = new Map<string, string>();
        try {
            if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
                const zonas = await (prisma as any).zonaCep.findMany({
                    select: { id: true, zonaNome: true }
                });
                zonas.forEach((z: any) => zonasMap.set(z.id, z.zonaNome));
            } else {
                const zonas = await prisma.$queryRaw<Array<{ id: string; zona_nome: string }>>`
                    SELECT id, zona_nome FROM zonas_cep
                `;
                zonas.forEach(z => zonasMap.set(z.id, z.zona_nome));
            }
        } catch (e) {
            // Se não conseguir buscar zonas, continuar sem elas
            console.warn('Erro ao buscar zonas:', e);
        }

        // Buscar restaurantes com Prisma
        const restaurants = await prisma.restaurant.findMany({
            include: {
                comments: true,
                seller: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        // Buscar zonaId separadamente via SQL para garantir que está presente
        let zonaIdMap = new Map<string, string | null>();
        try {
            // Verificar se a coluna existe
            const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'restaurants' AND column_name = 'zona_id'
            `;
            
            if (columnCheck.length > 0) {
                // Coluna existe, buscar zonaId
                const zonaIds = await prisma.$queryRaw<Array<{ id: string; zona_id: string | null }>>`
                    SELECT id, zona_id FROM restaurants
                `;
                zonaIds.forEach(z => zonaIdMap.set(z.id, z.zona_id));
            }
        } catch (e) {
            console.warn('Erro ao buscar zonaId dos restaurantes:', e);
        }

        return restaurants.map(r => {
            // Tentar pegar zonaId do SQL primeiro, senão do Prisma
            const zonaId = zonaIdMap.get(r.id) || (r as any).zonaId || undefined;
            const zonaNome = zonaId ? (zonasMap.get(zonaId) || undefined) : undefined;
            
            // Garantir que address sempre tenha valores padrão
            const rawAddress = (r.address as any) || {};
            const safeAddress = {
                street: rawAddress.street || rawAddress.rua || 'Endereço não informado',
                neighborhood: rawAddress.neighborhood || rawAddress.bairro || '',
                city: rawAddress.city || rawAddress.cidade || 'Cidade não informada',
                state: rawAddress.state || rawAddress.estado || 'Estado não informado',
                zip: rawAddress.zip || rawAddress.cep || rawAddress.zipCode || '',
            };
            
            return {
                id: r.id,
                name: r.name || 'Restaurante sem nome',
                rating: Number(r.rating || 0),
                reviewCount: r.reviewCount ?? 0,
                totalComments: r.totalComments ?? 0,
                projectedDeliveries: r.projectedDeliveries ?? 0,
                salesPotential: r.salesPotential || 'MÉDIO',
                address: safeAddress,
                lastCollectionDate: r.lastCollectionDate?.toISOString() || '',
                comments: r.comments.map(c => c.content),
                status: r.status || 'A Analisar',
                email: rawAddress?.email || '',
                zonaId: zonaId || undefined,
                zonaNome: zonaNome || undefined,
                seller: r.seller ? {
                    id: r.seller.id,
                    name: r.seller.name,
                    email: r.seller.email || undefined,
                    phone: r.seller.phone || undefined,
                    photoUrl: r.seller.photoUrl || undefined,
                    regions: r.seller.regions as string[],
                    neighborhoods: (r.seller.neighborhoods as string[]) || [],
                    active: r.seller.active || false
                } : undefined,
                assignedAt: r.assignedAt?.toISOString()
            };
        });
    } catch (error) {
        console.error('Erro ao buscar restaurantes:', error);
        return [];
    }
}

export async function saveStatus(id: string, status: string) {
    try {
        await prisma.restaurant.update({
            where: { id },
            data: { status }
        });
    } catch (error) {
        console.error('Erro ao salvar status:', error);
    }
}

export async function getStatus(id: string): Promise<string | null> {
    try {
        const restaurant = await prisma.restaurant.findUnique({
            where: { id },
            select: { status: true }
        });
        return restaurant?.status || null;
    } catch (error) {
        console.error('Erro ao buscar status:', error);
        return null;
    }
}

// Análises
export async function saveAnalysis(id: string, analysis: AnalysisResult) {
    try {
        await prisma.analysis.create({
            data: {
                restaurantId: id,
                score: analysis.score,
                summary: analysis.summary,
                painPoints: analysis.painPoints,
                salesCopy: analysis.salesCopy,
                strategy: analysis.strategy,
                status: analysis.status,
            }
        });
    } catch (error) {
        console.error('Erro ao salvar análise:', error);
    }
}

export async function getAnalysis(id: string): Promise<AnalysisResult | null> {
    try {
        const analysis = await prisma.analysis.findFirst({
            where: { restaurantId: id },
            orderBy: { createdAt: 'desc' }
        });

        if (!analysis) return null;

        return {
            restaurantId: id,
            score: analysis.score,
            summary: analysis.summary,
            painPoints: analysis.painPoints as string[],
            salesCopy: analysis.salesCopy || '',
            strategy: analysis.strategy || undefined,
            status: analysis.status as any,
        };
    } catch (error) {
        console.error('Erro ao buscar análise:', error);
        return null;
    }
}

// Notas
export async function saveNote(id: string, content: string) {
    try {
        const note = await prisma.note.create({
            data: {
                restaurantId: id,
                content
            }
        });

        return {
            id: note.id,
            content: note.content,
            createdAt: note.createdAt.toISOString(),
        };
    } catch (error) {
        console.error('Erro ao salvar nota:', error);
        return null;
    }
}

export async function getNotes(id: string): Promise<Note[]> {
    try {
        const notes = await prisma.note.findMany({
            where: { restaurantId: id },
            orderBy: { createdAt: 'desc' }
        });

        return notes.map(n => ({
            id: n.id,
            content: n.content,
            createdAt: n.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        return [];
    }
}

// Follow-ups
export async function saveFollowUp(followUp: FollowUp) {
    try {
        await prisma.followUp.upsert({
            where: { id: followUp.id },
            create: {
                id: followUp.id,
                restaurantId: followUp.restaurantId,
                type: followUp.type,
                scheduledDate: new Date(followUp.scheduledDate),
                completed: followUp.completed,
                completedDate: followUp.completedDate ? new Date(followUp.completedDate) : null,
                notes: followUp.notes,
                emailSubject: followUp.emailSubject,
                emailBody: followUp.emailBody,
                emailSent: followUp.emailSent,
            },
            update: {
                restaurantId: followUp.restaurantId,
                type: followUp.type,
                scheduledDate: new Date(followUp.scheduledDate),
                completed: followUp.completed,
                completedDate: followUp.completedDate ? new Date(followUp.completedDate) : null,
                notes: followUp.notes,
                emailSubject: followUp.emailSubject,
                emailBody: followUp.emailBody,
                emailSent: followUp.emailSent,
            }
        });
    } catch (error) {
        console.error('Erro ao salvar follow-up:', error);
    }
}

export async function getFollowUps(restaurantId?: string): Promise<FollowUp[]> {
    try {
        const followUps = await prisma.followUp.findMany({
            where: restaurantId ? { restaurantId } : undefined,
            orderBy: { scheduledDate: 'asc' }
        });

        return followUps.map(f => ({
            id: f.id,
            restaurantId: f.restaurantId,
            type: f.type as any,
            scheduledDate: f.scheduledDate.toISOString(),
            completed: f.completed,
            completedDate: f.completedDate?.toISOString(),
            notes: f.notes || undefined,
            emailSubject: f.emailSubject || undefined,
            emailBody: f.emailBody || undefined,
            emailSent: f.emailSent,
        }));
    } catch (error) {
        console.error('Erro ao buscar follow-ups:', error);
        return [];
    }
}

export async function getUpcomingFollowUps(): Promise<FollowUp[]> {
    try {
        const followUps = await prisma.followUp.findMany({
            where: {
                completed: false,
                scheduledDate: { gte: new Date() }
            },
            orderBy: { scheduledDate: 'asc' },
            include: {
                restaurant: true
            }
        });

        return followUps.map(f => ({
            id: f.id,
            restaurantId: f.restaurantId,
            type: f.type as any,
            scheduledDate: f.scheduledDate.toISOString(),
            completed: f.completed,
            completedDate: f.completedDate?.toISOString(),
            notes: f.notes || undefined,
            emailSubject: f.emailSubject || undefined,
            emailBody: f.emailBody || undefined,
            emailSent: f.emailSent,
            restaurantName: f.restaurant.name,
        } as any));
    } catch (error) {
        console.error('Erro ao buscar follow-ups futuros:', error);
        return [];
    }
}

// Metas
export async function saveGoal(goal: Goal) {
    try {
        await prisma.goal.upsert({
            where: { id: goal.id },
            create: {
                id: goal.id,
                name: goal.name,
                type: goal.type,
                target: goal.target,
                current: goal.current,
                period: goal.period,
                startDate: new Date(goal.startDate),
                endDate: new Date(goal.endDate),
                status: goal.status,
            },
            update: {
                name: goal.name,
                type: goal.type,
                target: goal.target,
                current: goal.current,
                period: goal.period,
                startDate: new Date(goal.startDate),
                endDate: new Date(goal.endDate),
                status: goal.status,
            }
        });
    } catch (error) {
        console.error('Erro ao salvar meta:', error);
    }
}

export async function getGoals(): Promise<Goal[]> {
    try {
        const goals = await prisma.goal.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return goals.map(g => ({
            id: g.id,
            name: g.name,
            type: g.type as any,
            target: Number(g.target),
            current: Number(g.current),
            period: g.period as any,
            startDate: g.startDate.toISOString(),
            endDate: g.endDate.toISOString(),
            status: g.status as any,
        }));
    } catch (error) {
        console.error('Erro ao buscar metas:', error);
        return [];
    }
}

// Dashboard Stats
export async function getDashboardStats() {
    try {
        const [totalRestaurants, qualifiedLeads, contactedLeads, negotiatingLeads, closedDeals, pendingAnalysis, hotLeads] = await Promise.all([
            prisma.restaurant.count(),
            prisma.restaurant.count({ where: { status: 'Qualificado' } }),
            prisma.restaurant.count({ where: { status: 'Contatado' } }),
            prisma.restaurant.count({ where: { status: 'Negociação' } }),
            prisma.restaurant.count({ where: { status: 'Fechado' } }),
            prisma.restaurant.count({ where: { status: 'A Analisar' } }),
            prisma.restaurant.findMany({
                where: { salesPotential: 'ALTÍSSIMO' },
                take: 10,
                orderBy: { projectedDeliveries: 'desc' }
            })
        ]);

        const avgRatingResult = await prisma.restaurant.aggregate({
            _avg: { rating: true }
        });

        return {
            totalRestaurants,
            qualifiedLeads,
            contactedLeads,
            negotiatingLeads,
            closedDeals,
            pendingAnalysis,
            hotLeadsCount: hotLeads.length,
            avgRating: avgRatingResult._avg.rating ? Number(avgRatingResult._avg.rating).toFixed(1) : '0',
            hotLeads: hotLeads.map(r => ({
                id: r.id,
                name: r.name,
                rating: Number(r.rating || 0),
                reviewCount: r.reviewCount ?? 0,
                totalComments: r.totalComments ?? 0,
                projectedDeliveries: r.projectedDeliveries ?? 0,
                salesPotential: r.salesPotential || 'N/A',
                address: r.address as any,
                lastCollectionDate: r.lastCollectionDate?.toISOString() || '',
                comments: [],
                status: r.status || undefined,
                email: '',
            })),
        };
    } catch (error) {
        console.error('Erro ao buscar stats do dashboard:', error);
        return {
            totalRestaurants: 0,
            qualifiedLeads: 0,
            contactedLeads: 0,
            negotiatingLeads: 0,
            closedDeals: 0,
            pendingAnalysis: 0,
            hotLeadsCount: 0,
            avgRating: '0',
            hotLeads: [],
        };
    }
}

// Activity Log
export async function getRecentActivities(limit: number = 10): Promise<Activity[]> {
    try {
        const activities = await prisma.activityLog.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                restaurant: true
            }
        });

        return activities.map(a => ({
            id: a.id,
            type: a.type as any,
            title: a.title,
            description: a.description || '',
            restaurantId: a.restaurantId || undefined,
            restaurantName: a.restaurant?.name,
            timestamp: a.createdAt.toISOString(),
            metadata: a.metadata as any,
        }));
    } catch (error) {
        console.error('Erro ao buscar atividades recentes:', error);
        return [];
    }
}

// Export Activity type
export type { Activity };

// Intelligent Segmentation
export async function getIntelligentSegmentation() {
    try {
        const restaurants = await getRestaurants();
        const analyses = await Promise.all(
            restaurants.map(r => getAnalysis(r.id))
        );

        const highPotential = restaurants.filter((r, i) => {
            const analysis = analyses[i];
            return (analysis && analysis.score >= 80) || r.salesPotential === 'ALTÍSSIMO';
        });

        const mediumPotential = restaurants.filter((r, i) => {
            const analysis = analyses[i];
            return (analysis && analysis.score >= 60 && analysis.score < 80) || r.salesPotential === 'ALTO';
        });

        const lowPotential = restaurants.filter((r, i) => {
            const analysis = analyses[i];
            return (!analysis || analysis.score < 60) && r.salesPotential !== 'ALTÍSSIMO' && r.salesPotential !== 'ALTO';
        });

        return {
            highPotential,
            mediumPotential,
            lowPotential,
            total: restaurants.length
        };
    } catch (error) {
        console.error('Erro ao buscar segmentação:', error);
        return {
            highPotential: [],
            mediumPotential: [],
            lowPotential: [],
            total: 0
        };
    }
}

// Sellers
export async function getSellers(): Promise<Seller[]> {
    try {
        const sellers = await prisma.seller.findMany({
            orderBy: { name: 'asc' }
        });
        
        return sellers.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email || '',
            phone: s.phone || '',
            photoUrl: s.photoUrl || undefined,
            regions: s.regions as string[],
            neighborhoods: s.neighborhoods as string[],
            active: s.active,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
        }));
    } catch (error) {
        console.error('Erro ao buscar vendedores:', error);
        return [];
    }
}
