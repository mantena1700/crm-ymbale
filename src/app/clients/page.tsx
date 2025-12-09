import { getRestaurants } from '@/lib/db-data';
import { prisma } from '@/lib/db';
import ClientsClientNew from './ClientsClientNew';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    const restaurants = await getRestaurants();
    
    // Buscar zonas disponíveis para o filtro
    let zonas: any[] = [];
    try {
        if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
            zonas = await (prisma as any).zonaCep.findMany({
                where: { ativo: true },
                orderBy: { zonaNome: 'asc' }
            });
        } else {
            // Fallback: usar SQL direto
            const result = await prisma.$queryRaw<Array<{
                id: string;
                zona_nome: string;
            }>>`SELECT id, zona_nome FROM zonas_cep WHERE ativo = true ORDER BY zona_nome ASC`;
            zonas = result.map(z => ({
                id: z.id,
                zonaNome: z.zona_nome
            }));
        }
    } catch (error: any) {
        console.warn('Erro ao buscar zonas:', error.message);
        zonas = [];
    }

    return <ClientsClientNew initialRestaurants={restaurants} availableZonas={zonas.map(z => ({
        id: z.id,
        zonaNome: z.zonaNome || (z as any).zona_nome
    }))} />;
}
