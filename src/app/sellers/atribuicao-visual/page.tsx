import { prisma } from '@/lib/db';
import AttributionMapClient from './AttributionMapClient';

export const dynamic = 'force-dynamic';

export default async function AttributionVisualPage() {
    const sellers = await prisma.seller.findMany({
        where: { active: true },
        select: {
            id: true,
            name: true,
            baseCidade: true,
            baseLatitude: true,
            baseLongitude: true,
            raioKm: true,
            territorioAtivo: true
        },
        orderBy: { name: 'asc' }
    });

    const restaurants = await prisma.restaurant.findMany({
        select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            sellerId: true,
            status: true,
            salesPotential: true
        },
        where: {
            latitude: { not: null },
            longitude: { not: null }
        }
    });

    return (
        <AttributionMapClient
            sellers={sellers.map(s => ({
                id: s.id,
                name: s.name,
                baseCidade: s.baseCidade,
                baseLatitude: s.baseLatitude ? Number(s.baseLatitude) : null,
                baseLongitude: s.baseLongitude ? Number(s.baseLongitude) : null,
                raioKm: s.raioKm,
                territorioAtivo: s.territorioAtivo
            }))}
            restaurants={restaurants.map(r => ({
                id: r.id,
                name: r.name,
                address: r.address,
                latitude: r.latitude,
                longitude: r.longitude,
                sellerId: r.sellerId,
                status: r.status,
                salesPotential: r.salesPotential
            }))}
        />
    );
}

