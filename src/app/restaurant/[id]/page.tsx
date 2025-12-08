import { getRestaurants, getNotes, getAnalysis } from '@/lib/db-data';
import AnalysisView from '@/components/AnalysisView';
import NotesSection from '@/components/NotesSection';
import styles from './page.module.css';
import Link from 'next/link';
import RestaurantDetailsClient from './RestaurantDetailsClient';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function RestaurantPage({ params }: PageProps) {
    const { id } = await params;
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === id);
    const notes = await getNotes(id);

    const analysis = await getAnalysis(id);
    const { prisma } = await import('@/lib/db');
    const sellers = await prisma.seller.findMany({
        where: { active: true },
        orderBy: { name: 'asc' }
    });

    if (!restaurant) {
        return <div>Restaurante não encontrado</div>;
    }

    return (
        <RestaurantDetailsClient
            restaurant={restaurant}
            initialAnalysis={analysis}
            initialNotes={notes}
            sellers={sellers.map(s => ({
                id: s.id,
                name: s.name,
                email: s.email || undefined,
                phone: s.phone || undefined,
                photoUrl: s.photoUrl || undefined,
                regions: s.regions as string[],
                neighborhoods: ((s as any).neighborhoods as string[]) || [],
                active: s.active
            }))}
        />
    );
}
