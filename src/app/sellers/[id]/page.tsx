import { prisma } from '@/lib/db';
import SellerDetailsClient from './SellerDetailsClient';

export const dynamic = 'force-dynamic';

export default async function SellerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const seller = await prisma.seller.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            active: true,
            areasCobertura: true,
            baseCidade: true,
            restaurants: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    status: true,
                    salesPotential: true
                }
            }
        }
    });

    if (!seller) {
        return <div>Vendedor não encontrado</div>;
    }

    // Converter areasCobertura para formato esperado
    let areas: string[] = [];
    if (seller.areasCobertura) {
        try {
            const areasData = typeof seller.areasCobertura === 'string' 
                ? JSON.parse(seller.areasCobertura) 
                : seller.areasCobertura;
            
            if (Array.isArray(areasData)) {
                areas = areasData.map((area: any) => {
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
            if (seller.baseCidade) {
                areas = [seller.baseCidade];
            }
        }
    } else if (seller.baseCidade) {
        areas = [seller.baseCidade];
    }

    return <SellerDetailsClient seller={{
        ...seller,
        regions: areas,
        neighborhoods: []
    } as any} />;
}
