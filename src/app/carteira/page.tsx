'use server';

import { prisma } from '@/lib/db';
import CarteiraClient from './CarteiraClient';

async function getData() {
    try {
        // Buscar vendedores ativos
        const sellers = await prisma.seller.findMany({
            where: { active: true },
            orderBy: { name: 'asc' }
        });

        // Buscar todos os restaurantes com seus vendedores
        const restaurants = await prisma.restaurant.findMany({
            include: {
                seller: true,
                comments: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Buscar follow-ups pendentes
        const followUps = await prisma.followUp.findMany({
            where: {
                completed: false
            },
            orderBy: { scheduledDate: 'asc' }
        });

        // Buscar visitas recentes
        let visits: any[] = [];
        try {
            visits = await prisma.visit.findMany({
                orderBy: { visitDate: 'desc' },
                take: 100
            });
        } catch (e) {
            console.log('Tabela visits não existe ainda');
        }

        return {
            sellers: sellers.map(s => ({
                id: s.id,
                name: s.name,
                email: s.email,
                phone: s.phone,
                photoUrl: s.photoUrl,
                regions: s.regions as string[],
                neighborhoods: s.neighborhoods as string[],
                active: s.active ?? true
            })),
            restaurants: restaurants.map(r => ({
                id: r.id,
                name: r.name,
                rating: r.rating ? Number(r.rating) : 0,
                reviewCount: r.reviewCount ? Number(r.reviewCount) : 0,
                category: r.category,
                address: r.address ? JSON.parse(JSON.stringify(r.address)) : null,
                status: r.status || 'A Analisar',
                salesPotential: r.salesPotential,
                projectedDeliveries: r.projectedDeliveries ? Number(r.projectedDeliveries) : 0,
                sellerId: r.sellerId,
                sellerName: r.seller?.name || null,
                commentsCount: r.comments.length,
                createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
                assignedAt: r.assignedAt?.toISOString() || null
            })),
            followUps: followUps.map(f => ({
                id: f.id,
                restaurantId: f.restaurantId,
                type: f.type,
                scheduledDate: f.scheduledDate.toISOString(),
                notes: f.notes
            })),
            visits: visits.map(v => ({
                id: v.id,
                restaurantId: v.restaurantId,
                sellerId: v.sellerId,
                visitDate: v.visitDate.toISOString(),
                feedback: v.feedback,
                outcome: v.outcome,
                nextVisitDate: v.nextVisitDate?.toISOString() || null
            }))
        };
    } catch (error) {
        console.error('Erro ao buscar dados da carteira:', error);
        return {
            sellers: [],
            restaurants: [],
            followUps: [],
            visits: []
        };
    }
}

export default async function CarteiraPage() {
    const data = await getData();

    return <CarteiraClient initialData={data} />;
}

