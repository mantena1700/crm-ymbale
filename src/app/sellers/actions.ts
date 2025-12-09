'use server';

import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

// Função para garantir que a tabela seller_zonas existe
async function ensureSellerZonasTableExists() {
    try {
        // Verificar se a tabela existe
        await prisma.$queryRaw`SELECT 1 FROM seller_zonas LIMIT 1`;
    } catch (error: any) {
        // Se a tabela não existir (código 42P01), criar
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
            console.log('Criando tabela seller_zonas...');
            
            // Verificar se zonas_cep existe primeiro
            try {
                await prisma.$queryRaw`SELECT 1 FROM zonas_cep LIMIT 1`;
            } catch (zonaError: any) {
                // Se zonas_cep não existir, criar primeiro
                if (zonaError.code === '42P01' || zonaError.message?.includes('does not exist') || zonaError.message?.includes('relation')) {
                    await prisma.$executeRaw`
                        CREATE TABLE IF NOT EXISTS zonas_cep (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            zona_nome VARCHAR(100) NOT NULL,
                            cep_inicial VARCHAR(9) NOT NULL,
                            cep_final VARCHAR(9) NOT NULL,
                            ativo BOOLEAN DEFAULT true,
                            created_at TIMESTAMPTZ(6) DEFAULT NOW(),
                            updated_at TIMESTAMPTZ(6) DEFAULT NOW()
                        )
                    `;
                    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_zonas_cep_ativo ON zonas_cep(ativo)`;
                    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_zonas_cep_range ON zonas_cep(cep_inicial, cep_final)`;
                }
            }
            
            // Agora criar seller_zonas
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS seller_zonas (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    seller_id UUID NOT NULL,
                    zona_id UUID NOT NULL,
                    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
                    CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
                    CONSTRAINT fk_zona FOREIGN KEY (zona_id) REFERENCES zonas_cep(id) ON DELETE CASCADE,
                    CONSTRAINT unique_seller_zona UNIQUE (seller_id, zona_id)
                )
            `;
            
            // Criar índices
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_seller_zonas_seller_id ON seller_zonas(seller_id)`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_seller_zonas_zona_id ON seller_zonas(zona_id)`;
            
            console.log('Tabela seller_zonas criada com sucesso!');
        } else {
            throw error;
        }
    }
}

// Atribuir restaurantes automaticamente ao executivo baseado nas zonas
async function assignRestaurantsToSellerByZones(sellerId: string, zonasIds: string[]) {
    if (!zonasIds || zonasIds.length === 0) return { assigned: 0 };
    
    try {
        // Verificar se a coluna zona_id existe
        let columnExists = false;
        try {
            const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'restaurants' AND column_name = 'zona_id'
            `;
            columnExists = columnCheck.length > 0;
        } catch (e) {
            console.warn('Erro ao verificar coluna zona_id:', e);
        }

        if (!columnExists) {
            console.warn('Coluna zona_id não existe ainda. Execute a alocação de zonas primeiro.');
            return { assigned: 0 };
        }

        const restaurantIds: string[] = [];
        
        // Buscar restaurantes uma zona por vez (mais compatível)
        for (const zonaId of zonasIds) {
            try {
                const result = await prisma.$queryRaw<Array<{ id: string }>>`
                    SELECT id FROM restaurants 
                    WHERE zona_id = ${zonaId}::uuid 
                    AND (seller_id IS NULL OR seller_id != ${sellerId}::uuid)
                `;
                restaurantIds.push(...result.map(r => r.id));
            } catch (zonaError: any) {
                console.warn(`Erro ao buscar restaurantes da zona ${zonaId}:`, zonaError.message);
            }
        }

        if (restaurantIds.length === 0) {
            return { assigned: 0 };
        }

        // Atualizar restaurantes um por um para garantir compatibilidade
        let updated = 0;
        for (const restaurantId of restaurantIds) {
            try {
                await prisma.$executeRaw`
                    UPDATE restaurants 
                    SET seller_id = ${sellerId}::uuid,
                        assigned_at = NOW()
                    WHERE id = ${restaurantId}::uuid
                `;
                updated++;
            } catch (updateError: any) {
                // Se falhar com SQL, tentar com Prisma
                try {
                    await prisma.restaurant.update({
                        where: { id: restaurantId },
                        data: { 
                            sellerId,
                            assignedAt: new Date()
                        }
                    });
                    updated++;
                } catch (prismaError: any) {
                    console.warn(`Erro ao atualizar restaurante ${restaurantId}:`, prismaError.message);
                }
            }
        }

        if (updated > 0) {
            console.log(`✅ ${updated} restaurantes atribuídos automaticamente ao executivo baseado nas zonas`);
        }

        return { assigned: updated };
    } catch (error: any) {
        console.error('Erro ao atribuir restaurantes por zonas:', error);
        return { assigned: 0 };
    }
}

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
    zonasIds: string[];
    active: boolean;
}) {
    const seller = await prisma.seller.create({
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            photoUrl: data.photoUrl || null,
            regions: [], // Mantido para compatibilidade
            neighborhoods: [], // Mantido para compatibilidade
            active: data.active
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

    return {
        id: seller.id,
        name: seller.name,
        email: seller.email || '',
        phone: seller.phone || '',
        photoUrl: seller.photoUrl || undefined,
        regions: [],
        neighborhoods: [],
        active: seller.active
    };
}

export async function updateSeller(id: string, data: {
    name: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    zonasIds: string[];
    active: boolean;
}) {
    const seller = await prisma.seller.update({
        where: { id },
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            photoUrl: data.photoUrl || null,
            active: data.active
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
        try {
            await assignRestaurantsToSellerByZones(id, data.zonasIds);
        } catch (error: any) {
            console.warn('Erro ao atribuir restaurantes automaticamente:', error.message);
            // Não falhar a atualização do executivo se a atribuição de restaurantes falhar
        }
    }

    revalidatePath('/sellers');
    revalidatePath('/settings');
    revalidatePath('/carteira');
    revalidatePath('/pipeline');
    revalidatePath('/clients');

    return {
        id: seller.id,
        name: seller.name,
        email: seller.email || '',
        phone: seller.phone || '',
        photoUrl: seller.photoUrl || undefined,
        regions: [],
        neighborhoods: [],
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
