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
    zonasIds: string[];
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

    // Criar relacionamentos com zonas (usar modelo se disponível, senão SQL direto)
    if (data.zonasIds && data.zonasIds.length > 0) {
        try {
            // Garantir que a tabela existe
            await ensureSellerZonasTableExists();
            
            if (prisma && typeof (prisma as any).sellerZona !== 'undefined') {
                await (prisma as any).sellerZona.createMany({
                    data: data.zonasIds.map(zonaId => ({
                        sellerId: seller.id,
                        zonaId: zonaId
                    }))
                });
            } else {
                // Fallback: usar SQL direto (com cast explícito para UUID)
                for (const zonaId of data.zonasIds) {
                    await prisma.$executeRaw`
                        INSERT INTO seller_zonas (id, seller_id, zona_id, created_at)
                        VALUES (gen_random_uuid(), ${seller.id}::uuid, ${zonaId}::uuid, NOW())
                        ON CONFLICT (seller_id, zona_id) DO NOTHING
                    `;
                }
            }
        } catch (error: any) {
            // Se a tabela não existir, apenas logar o erro
            if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
                console.warn('Tabela seller_zonas não existe ainda. Execute: npx prisma db push');
            } else {
                throw error;
            }
        }
    }

    // Após criar o executivo, atribuir automaticamente os restaurantes das zonas ao executivo
    if (data.zonasIds && data.zonasIds.length > 0 && seller.active) {
        try {
            await assignRestaurantsToSellerByZones(seller.id, data.zonasIds);
        } catch (error: any) {
            console.warn('Erro ao atribuir restaurantes automaticamente:', error.message);
            // Não falhar a criação do executivo se a atribuição de restaurantes falhar
        }
    }

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
        zonasIds: [],
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
    zonasIds: string[];
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

    // Remover todas as zonas antigas e adicionar as novas (usar modelo se disponível, senão SQL direto)
    try {
        // Garantir que a tabela existe
        await ensureSellerZonasTableExists();
        
        if (prisma && typeof (prisma as any).sellerZona !== 'undefined') {
            // Usar modelo Prisma
            await (prisma as any).sellerZona.deleteMany({
                where: { sellerId: id }
            });

            if (data.zonasIds && data.zonasIds.length > 0) {
                await (prisma as any).sellerZona.createMany({
                    data: data.zonasIds.map(zonaId => ({
                        sellerId: id,
                        zonaId: zonaId
                    }))
                });
            }
        } else {
            // Fallback: usar SQL direto
            try {
                await prisma.$executeRaw`DELETE FROM seller_zonas WHERE seller_id = ${id}::uuid`;

                if (data.zonasIds && data.zonasIds.length > 0) {
                    for (const zonaId of data.zonasIds) {
                        try {
                            await prisma.$executeRaw`
                                INSERT INTO seller_zonas (id, seller_id, zona_id, created_at)
                                VALUES (gen_random_uuid(), ${id}::uuid, ${zonaId}::uuid, NOW())
                                ON CONFLICT (seller_id, zona_id) DO NOTHING
                            `;
                        } catch (insertError: any) {
                            // Se falhar, tentar sem ON CONFLICT
                            console.warn(`Erro ao inserir zona ${zonaId}, tentando sem ON CONFLICT:`, insertError.message);
                            await prisma.$executeRaw`
                                INSERT INTO seller_zonas (id, seller_id, zona_id, created_at)
                                SELECT gen_random_uuid(), ${id}::uuid, ${zonaId}::uuid, NOW()
                                WHERE NOT EXISTS (
                                    SELECT 1 FROM seller_zonas 
                                    WHERE seller_id = ${id}::uuid AND zona_id = ${zonaId}::uuid
                                )
                            `;
                        }
                    }
                }
            } catch (sqlError: any) {
                console.error('Erro ao atualizar zonas via SQL:', sqlError);
                throw sqlError;
            }
        }
    } catch (error: any) {
        // Se a tabela não existir, apenas logar o erro
        if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
            console.warn('Tabela seller_zonas não existe ainda. Execute: npx prisma db push');
        } else {
            throw error;
        }
    }

    // Após atualizar as zonas, atribuir automaticamente os restaurantes dessas zonas ao executivo
    if (data.zonasIds && data.zonasIds.length > 0 && seller.active) {
        console.log(`\n🔄 Atualizando executivo ${id} - atribuindo restaurantes das zonas...`);
        try {
            const result = await assignRestaurantsToSellerByZones(id, data.zonasIds);
            console.log(`✅ ${result.assigned} restaurante(s) atribuído(s) ao executivo ${id}`);
        } catch (error: any) {
            console.error('❌ Erro ao atribuir restaurantes automaticamente:', error.message);
            console.error('   Stack:', error.stack);
            // Não falhar a atualização do executivo se a atribuição de restaurantes falhar
        }
    } else {
        console.log(`\n⚠️ Executivo ${id} não receberá restaurantes: zonas=${data.zonasIds?.length || 0}, ativo=${seller.active}`);
    }

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
        zonasIds: [],
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
