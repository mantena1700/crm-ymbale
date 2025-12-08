'use server';

import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

// Atribuir restaurantes automaticamente quando vendedor recebe novos bairros
async function assignRestaurantsToSellerByNeighborhood(sellerId: string, neighborhoods: string[]) {
    if (!neighborhoods || neighborhoods.length === 0) return { assigned: 0 };
    
    try {
        // Buscar todos os restaurantes sem vendedor
        const allRestaurants = await prisma.restaurant.findMany({
            where: {
                sellerId: null
            },
            select: {
                id: true,
                address: true
            }
        });
        
        // Filtrar restaurantes que estão nos bairros do vendedor
        const matchingIds: string[] = [];
        for (const restaurant of allRestaurants) {
            const address = restaurant.address as any;
            if (address?.neighborhood) {
                const neighborhood = address.neighborhood.toLowerCase().trim();
                if (neighborhoods.some(n => neighborhood.includes(n.toLowerCase().trim()) || n.toLowerCase().trim().includes(neighborhood))) {
                    matchingIds.push(restaurant.id);
                }
            }
        }
        
        if (matchingIds.length === 0) return { assigned: 0 };
        
        // Atribuir ao vendedor
        await prisma.restaurant.updateMany({
            where: {
                id: { in: matchingIds }
            },
            data: {
                sellerId,
                assignedAt: new Date()
            }
        });
        
        // Criar notificação
        await prisma.notification.create({
            data: {
                type: 'assignment',
                title: 'Clientes Atribuídos Automaticamente',
                message: `${matchingIds.length} clientes foram atribuídos automaticamente baseado nos bairros: ${neighborhoods.join(', ')}`,
                severity: 'info'
            }
        });
        
        return { assigned: matchingIds.length };
    } catch (error) {
        console.error('Erro ao atribuir restaurantes:', error);
        return { assigned: 0 };
    }
}

export async function createSeller(data: {
    name: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    regions: string[];
    neighborhoods: string[];
    active: boolean;
}) {
    const seller = await prisma.seller.create({
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            photoUrl: data.photoUrl || null,
            regions: data.regions,
            neighborhoods: data.neighborhoods,
            active: data.active
        }
    });

    // Atribuir restaurantes automaticamente baseado nos bairros
    if (data.neighborhoods && data.neighborhoods.length > 0 && data.active) {
        const result = await assignRestaurantsToSellerByNeighborhood(seller.id, data.neighborhoods);
        console.log(`[createSeller] ${result.assigned} restaurantes atribuídos automaticamente`);
    }

    revalidatePath('/sellers');
    revalidatePath('/settings');
    revalidatePath('/carteira');
    revalidatePath('/pipeline');

    return {
        id: seller.id,
        name: seller.name,
        email: seller.email || '',
        phone: seller.phone || '',
        photoUrl: seller.photoUrl || undefined,
        regions: seller.regions as string[],
        neighborhoods: seller.neighborhoods as string[],
        active: seller.active
    };
}

export async function updateSeller(id: string, data: {
    name: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    regions: string[];
    neighborhoods: string[];
    active: boolean;
}) {
    // Buscar vendedor atual para comparar bairros
    const currentSeller = await prisma.seller.findUnique({
        where: { id },
        select: { neighborhoods: true }
    });
    
    const currentNeighborhoods = (currentSeller?.neighborhoods as string[]) || [];
    const newNeighborhoods = data.neighborhoods.filter(n => !currentNeighborhoods.includes(n));
    
    const seller = await prisma.seller.update({
        where: { id },
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            photoUrl: data.photoUrl || null,
            regions: data.regions,
            neighborhoods: data.neighborhoods,
            active: data.active
        }
    });

    // Atribuir restaurantes automaticamente para novos bairros
    if (newNeighborhoods.length > 0 && data.active) {
        const result = await assignRestaurantsToSellerByNeighborhood(id, newNeighborhoods);
        console.log(`[updateSeller] ${result.assigned} restaurantes atribuídos para novos bairros`);
    }

    revalidatePath('/sellers');
    revalidatePath('/settings');
    revalidatePath('/carteira');
    revalidatePath('/pipeline');

    return {
        id: seller.id,
        name: seller.name,
        email: seller.email || '',
        phone: seller.phone || '',
        photoUrl: seller.photoUrl || undefined,
        regions: seller.regions as string[],
        neighborhoods: seller.neighborhoods as string[],
        active: seller.active
    };
}

export async function deleteSeller(id: string) {
    await prisma.seller.delete({
        where: { id }
    });

    revalidatePath('/sellers');
    revalidatePath('/settings');
}

// Upload de foto agora é feito via API route: /api/sellers/upload
// Isso evita o limite de 1MB dos Server Actions
