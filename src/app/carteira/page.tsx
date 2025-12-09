import { prisma } from '@/lib/db';
import CarteiraClient from './CarteiraClient';

export const dynamic = 'force-dynamic';

async function getData() {
    try {
        // Buscar executivos ativos
        const sellers = await prisma.seller.findMany({
            where: { active: true },
            orderBy: { name: 'asc' }
        });

        // Buscar zonas de cada executivo via SQL direto
        const sellerZonasMap = new Map<string, string[]>();
        try {
            // Verificar se a tabela existe
            await prisma.$queryRaw`SELECT 1 FROM seller_zonas LIMIT 1`;
            
            // Buscar todas as relações seller-zona com nomes das zonas
            const sellerZonas = await prisma.$queryRaw<Array<{
                seller_id: string;
                zona_id: string;
                zona_nome: string;
            }>>`
                SELECT 
                    sz.seller_id::text,
                    sz.zona_id::text,
                    z.zona_nome
                FROM seller_zonas sz
                INNER JOIN zonas_cep z ON z.id = sz.zona_id
                WHERE z.ativo = true
            `;
            
            // Agrupar nomes das zonas por seller
            sellerZonas.forEach(sz => {
                const current = sellerZonasMap.get(sz.seller_id) || [];
                if (!current.includes(sz.zona_nome)) {
                    sellerZonasMap.set(sz.seller_id, [...current, sz.zona_nome]);
                }
            });
            
            console.log(`Zonas carregadas para ${sellerZonas.length} relações seller-zona`);
            sellers.forEach(s => {
                const zonas = sellerZonasMap.get(s.id) || [];
                if (zonas.length > 0) {
                    console.log(`Executivo ${s.name}: ${zonas.length} zonas - ${zonas.join(', ')}`);
                }
            });
        } catch (error: any) {
            // Se a tabela não existir, usar array vazio
            if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
                console.warn('Tabela seller_zonas não existe ainda. As zonas não serão carregadas.');
            } else {
                console.error('Erro ao buscar zonas dos sellers:', error.message);
                console.error('Stack:', error.stack);
            }
        }

        // Buscar todos os restaurantes com seus executivos
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
            sellers: sellers.map(s => {
                const zonasNomes = sellerZonasMap.get(s.id) || [];
                return {
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    phone: s.phone,
                    photoUrl: s.photoUrl,
                    zonas: zonasNomes, // Usar zonas ao invés de regions/neighborhoods
                    active: s.active ?? true
                };
            }),
            restaurants: restaurants.map(r => ({
                id: r.id,
                name: r.name,
                rating: r.rating ? Number(r.rating) : 0,
                reviewCount: r.reviewCount ? Number(r.reviewCount) : 0,
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

