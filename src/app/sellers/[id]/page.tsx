import { prisma } from '@/lib/db';
import SellerDetailsClient from './SellerDetailsClient';

export default async function SellerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const seller = await prisma.seller.findUnique({
        where: { id },
        include: {
            restaurants: true
        }
    });

    if (!seller) {
        return <div>Vendedor não encontrado</div>;
    }

    return <SellerDetailsClient seller={seller as any} />;
}
