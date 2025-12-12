import { getFollowUps, getRestaurants } from '@/lib/db-data';
import { prisma } from '@/lib/db';
import AgendaClient from './AgendaClient';

// Forçar renderização dinâmica (não pré-renderizar durante o build)
export const dynamic = 'force-dynamic';

export default async function AgendaPage() {
    const followUps = await getFollowUps();
    const restaurants = await getRestaurants();
    
    // Buscar executivos (sellers) disponíveis para o filtro
    let sellers: any[] = [];
    try {
        const result = await prisma.seller.findMany({
            where: { active: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true
            }
        });
        sellers = result;
    } catch (error: any) {
        console.warn('Erro ao buscar executivos:', error.message);
        sellers = [];
    }
    
    // Enrich follow-ups with restaurant data
    const enrichedFollowUps = followUps.map(f => ({
        ...f,
        restaurant: restaurants.find(r => r.id === f.restaurantId)
    }));
    
    return <AgendaClient initialFollowUps={enrichedFollowUps} restaurants={restaurants} availableSellers={sellers} />;
}

