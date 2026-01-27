
import { prisma } from '@/lib/db';
import Link from 'next/link';
import PageContent from './PageContent';

export const dynamic = 'force-dynamic';

async function getData() {
    try {
        // Buscar executivos ativos
        const sellers = await prisma.seller.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                email: true,
                active: true,
            },
            orderBy: { name: 'asc' }
        });

        // Buscar restaurantes básicos para seleção
        const restaurants = await prisma.restaurant.findMany({
            select: {
                id: true,
                name: true,
                address: true,
                sellerId: true
            },
            orderBy: { name: 'asc' }
        });

        return {
            sellers,
            restaurants: restaurants.map(r => ({
                id: r.id,
                name: r.name,
                address: r.address ? JSON.parse(JSON.stringify(r.address)) : null,
                sellerId: r.sellerId
            }))
        };
    } catch (error) {
        console.error('Erro ao buscar dados para clientes fixos:', error);
        return {
            sellers: [],
            restaurants: []
        };
    }
}

export default async function FixedClientsPage() {
    const data = await getData();

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Link
                    href="/carteira"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        textDecoration: 'none',
                        color: '#666',
                        fontWeight: 500
                    }}
                >
                    ⬅️ Voltar para Carteira
                </Link>
            </div>

            <PageContent sellers={data.sellers} restaurants={data.restaurants} />
        </div>
    );
}
