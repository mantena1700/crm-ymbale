import { prisma } from '@/lib/db';
import CarteiraClient from './CarteiraClient';

export const dynamic = 'force-dynamic';

async function getData() {
    try {
        // Buscar executivos ativos com áreas de cobertura
        const sellers = await prisma.seller.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                photoUrl: true,
                active: true,
                areasCobertura: true,
                baseCidade: true,
                baseLatitude: true,
                baseLongitude: true,
                raioKm: true
            },
            orderBy: { name: 'asc' }
        });

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
                // Converter areasCobertura para array de nomes de cidades
                let areasNomes: string[] = [];
                if (s.areasCobertura) {
                    try {
                        const areas = typeof s.areasCobertura === 'string' 
                            ? JSON.parse(s.areasCobertura) 
                            : s.areasCobertura;
                        
                        if (Array.isArray(areas)) {
                            areasNomes = areas.map((area: any) => {
                                if (typeof area === 'string') {
                                    try {
                                        const parsed = JSON.parse(area);
                                        return parsed.cidade || area;
                                    } catch {
                                        return area;
                                    }
                                }
                                return area?.cidade || area?.city || 'Área sem nome';
                            });
                        }
                    } catch (e) {
                        // Se não conseguir parsear, usar cidade base se existir
                        if (s.baseCidade) {
                            areasNomes = [s.baseCidade];
                        }
                    }
                } else if (s.baseCidade) {
                    // Fallback: usar cidade base se não tiver áreas configuradas
                    areasNomes = [s.baseCidade];
                }
                
                return {
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    phone: s.phone,
                    photoUrl: s.photoUrl,
                    zonas: areasNomes, // Agora são áreas de cobertura (cidades)
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

