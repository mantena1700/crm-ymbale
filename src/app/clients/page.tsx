import { getRestaurants } from '@/lib/db-data';
import { prisma } from '@/lib/db';
import ClientsClientNew from './ClientsClientNew';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    const restaurants = await getRestaurants();
    
    // Buscar executivos (sellers) disponíveis para o filtro
    let sellers: any[] = [];
    try {
        const result = await prisma.seller.findMany({
            where: { active: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true
            }
        });
        sellers = result;
    } catch (error: any) {
        console.warn('Erro ao buscar executivos:', error.message);
        sellers = [];
    }

    return <ClientsClientNew initialRestaurants={restaurants} availableSellers={sellers} />;
}
