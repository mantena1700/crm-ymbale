// src/lib/db-data.ts
// Camada de dados usando Prisma para buscar do banco de dados Supabase
import { prisma } from './db';
import { Restaurant, AnalysisResult, Note, FollowUp, Goal, Activity } from './types';

// Restaurantes
export async function getRestaurants(): Promise<Restaurant[]> {
    const restaurants = await prisma.restaurant.findMany({
        include: {
            comments: true,
            seller: true,
        },
        orderBy: { createdAt: 'desc' }
    });
    
    return restaurants.map(r => ({
        id: r.id,
        name: r.name,
        rating: Number(r.rating || 0),
        reviewCount: r.reviewCount,
        totalComments: r.totalComments,
        projectedDeliveries: r.projectedDeliveries,
        salesPotential: r.salesPotential || 'N/A',
        category: r.category || 'N/A',
        address: r.address as any,
        lastCollectionDate: r.lastCollectionDate?.toISOString() || '',
        comments: r.comments.map(c => c.content),
        status: r.status || undefined,
        email: (r.address as any)?.email || '',
    }));
}

export async function saveStatus(id: string, status: string) {
    await prisma.restaurant.update({
        where: { id },
        data: { status }
    });
}

export async function getStatus(id: string): Promise<string | null> {
    const restaurant = await prisma.restaurant.findUnique({
        where: { id },
        select: { status: true }
    });
    return restaurant?.status || null;
}

// Análises
export async function saveAnalysis(id: string, analysis: AnalysisResult) {
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
}

export async function getAnalysis(id: string): Promise<AnalysisResult | null> {
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
}

// Notas
export async function saveNote(id: string, content: string) {
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
}

export async function getNotes(id: string): Promise<Note[]> {
    const notes = await prisma.note.findMany({
        where: { restaurantId: id },
        orderBy: { createdAt: 'desc' }
    });
    
    return notes.map(n => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
    }));
}

// Follow-ups
export async function saveFollowUp(followUp: FollowUp) {
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
}

export async function getFollowUps(restaurantId?: string): Promise<FollowUp[]> {
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
}

export async function getUpcomingFollowUps(): Promise<FollowUp[]> {
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
}

// Metas
export async function saveGoal(goal: Goal) {
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
}

export async function getGoals(): Promise<Goal[]> {
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
}

// Dashboard Stats
export async function getDashboardStats() {
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
        projectedRevenue: hotLeads.reduce((sum, r) => sum + r.projectedDeliveries, 0) * 2.5,
        hotLeads: hotLeads.map(r => ({
            id: r.id,
            name: r.name,
            rating: Number(r.rating || 0),
            reviewCount: r.reviewCount,
            totalComments: r.totalComments,
            projectedDeliveries: r.projectedDeliveries,
            salesPotential: r.salesPotential || 'N/A',
            category: r.category || 'N/A',
            address: r.address as any,
            lastCollectionDate: r.lastCollectionDate?.toISOString() || '',
            comments: [],
            status: r.status || undefined,
            email: '',
        })),
    };
}

// Activity Log
export async function getRecentActivities(limit: number = 10): Promise<Activity[]> {
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
}

// Export Activity type
export type { Activity };

