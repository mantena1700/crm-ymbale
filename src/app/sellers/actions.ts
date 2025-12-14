'use server';

import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

// Funções relacionadas a zonas removidas - sistema agora usa apenas atribuição geográfica via Google Maps

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
                message: `${matchingIds.length} clientes foram atribuídos automaticamente baseado nos bairros: ${neighborhoods.join(', ')}`
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
    active: boolean;
    territorioTipo?: string;
    baseCidade?: string;
    baseLatitude?: number;
    baseLongitude?: number;
    raioKm?: number;
    territorioAtivo?: boolean;
    areasCobertura?: any;
}) {
    const seller = await prisma.seller.create({
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            photoUrl: data.photoUrl || null,
            regions: [], // Mantido para compatibilidade
            neighborhoods: [], // Mantido para compatibilidade
            active: data.active,
            territorioTipo: data.territorioTipo || 'raio',
            baseCidade: data.baseCidade || null,
            baseLatitude: data.baseLatitude ? data.baseLatitude : null,
            baseLongitude: data.baseLongitude ? data.baseLongitude : null,
            raioKm: data.raioKm || null,
            territorioAtivo: data.territorioAtivo !== undefined ? data.territorioAtivo : true,
            areasCobertura: data.areasCobertura ? data.areasCobertura : null
        }
    });

    // Sistema agora usa apenas atribuição geográfica via Google Maps
    // Restaurantes serão atribuídos automaticamente quando importados ou sincronizados

    revalidatePath('/sellers');
    revalidatePath('/settings');
    revalidatePath('/carteira');
    revalidatePath('/pipeline');
    revalidatePath('/clients');

    const createdSeller = await prisma.seller.findUnique({
        where: { id: seller.id },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            active: true,
            territorioTipo: true,
            baseCidade: true,
            baseLatitude: true,
            baseLongitude: true,
            raioKm: true,
            territorioAtivo: true,
            areasCobertura: true
        }
    });

    return {
        id: createdSeller!.id,
        name: createdSeller!.name,
        email: createdSeller!.email || '',
        phone: createdSeller!.phone || '',
        photoUrl: createdSeller!.photoUrl || undefined,
        regions: [],
        neighborhoods: [],
        active: createdSeller!.active || false,
        territorioTipo: createdSeller!.territorioTipo,
        baseCidade: createdSeller!.baseCidade,
        baseLatitude: createdSeller!.baseLatitude ? Number(createdSeller!.baseLatitude) : null,
        baseLongitude: createdSeller!.baseLongitude ? Number(createdSeller!.baseLongitude) : null,
        raioKm: createdSeller!.raioKm,
        territorioAtivo: createdSeller!.territorioAtivo,
        areasCobertura: createdSeller!.areasCobertura as any
    };
}

export async function updateSeller(id: string, data: {
    name: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    active: boolean;
    territorioTipo?: string;
    baseCidade?: string;
    baseLatitude?: number;
    baseLongitude?: number;
    raioKm?: number;
    territorioAtivo?: boolean;
    areasCobertura?: any;
}) {
    const seller = await prisma.seller.update({
        where: { id },
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            photoUrl: data.photoUrl || null,
            active: data.active,
            territorioTipo: data.territorioTipo || 'raio',
            baseCidade: data.baseCidade || null,
            baseLatitude: data.baseLatitude ? data.baseLatitude : null,
            baseLongitude: data.baseLongitude ? data.baseLongitude : null,
            raioKm: data.raioKm || null,
            territorioAtivo: data.territorioAtivo !== undefined ? data.territorioAtivo : true,
            areasCobertura: data.areasCobertura ? data.areasCobertura : null
        }
    });

    // Sistema agora usa apenas atribuição geográfica via Google Maps
    // Restaurantes serão atribuídos automaticamente quando importados ou sincronizados

    revalidatePath('/sellers');
    revalidatePath('/settings');
    revalidatePath('/carteira');
    revalidatePath('/pipeline');
    revalidatePath('/clients');

    const updatedSeller = await prisma.seller.findUnique({
        where: { id: seller.id },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            active: true,
            territorioTipo: true,
            baseCidade: true,
            baseLatitude: true,
            baseLongitude: true,
            raioKm: true,
            territorioAtivo: true
        }
    });

    return {
        id: updatedSeller!.id,
        name: updatedSeller!.name,
        email: updatedSeller!.email || '',
        phone: updatedSeller!.phone || '',
        photoUrl: updatedSeller!.photoUrl || undefined,
        regions: [],
        neighborhoods: [],
        active: updatedSeller!.active || false,
        territorioTipo: updatedSeller!.territorioTipo,
        baseCidade: updatedSeller!.baseCidade,
        baseLatitude: updatedSeller!.baseLatitude ? Number(updatedSeller!.baseLatitude) : null,
        baseLongitude: updatedSeller!.baseLongitude ? Number(updatedSeller!.baseLongitude) : null,
        raioKm: updatedSeller!.raioKm,
        territorioAtivo: updatedSeller!.territorioAtivo
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
