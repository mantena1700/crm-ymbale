'use server';

import { revalidatePath } from 'next/cache';
import { getRestaurants, saveStatus, saveNote } from '@/lib/db-data';

// Função para criar notificações automaticamente
async function createSystemNotification(type: string, title: string, message: string, metadata?: any) {
    try {
        const { prisma } = await import('@/lib/db');
        await prisma.notification.create({
            data: {
                type,
                title,
                message,
                metadata: metadata || {},
                read: false
            }
        });
        revalidatePath('/notifications');
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
    }
}

// Atualizar status do cliente
export async function updateRestaurantStatus(id: string, newStatus: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === id);

    if (restaurant) {
        restaurant.status = newStatus;
        await saveStatus(id, newStatus);

        // Criar notificação para mudanças de status importantes
        if (newStatus === 'Fechado') {
            await createSystemNotification(
                'success',
                '🎉 Negócio Fechado!',
                `${restaurant.name} foi convertido com sucesso!`,
                { restaurantId: id }
            );
        } else if (newStatus === 'Qualificado') {
            await createSystemNotification(
                'lead',
                '🎯 Lead Qualificado',
                `${restaurant.name} foi qualificado para abordagem comercial.`,
                { restaurantId: id }
            );
        }

        revalidatePath('/pipeline');
        revalidatePath(`/restaurant/${id}`);
        revalidatePath('/clients');
    }
}

// Atribuir cliente a executivo
export async function updateRestaurantSeller(id: string, sellerId: string | null) {
    const { prisma } = await import('@/lib/db');
    await prisma.restaurant.update({
        where: { id },
        data: {
            sellerId: sellerId,
            assignedAt: sellerId ? new Date() : null
        }
    });
    revalidatePath(`/restaurant/${id}`);
    revalidatePath('/pipeline');
    revalidatePath('/clients');
}

// Adicionar nota ao cliente
export async function addNote(restaurantId: string, content: string) {
    await saveNote(restaurantId, content);
    revalidatePath(`/restaurant/${restaurantId}`);
    return { success: true };
}

// Gerar próximo código de cliente
async function getNextCodigoCliente(): Promise<number> {
    const { prisma } = await import('@/lib/db');

    const maxCodigo = await prisma.restaurant.findFirst({
        where: {
            codigoCliente: {
                not: null
            }
        },
        orderBy: {
            codigoCliente: 'desc'
        },
        select: {
            codigoCliente: true
        }
    });

    const startCode = 10000;
    const nextCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : startCode;

    return Math.max(nextCode, startCode);
}

// Gerar códigos para clientes sem código
export async function generateMissingCodigosCliente() {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        const restaurantsWithoutCode = await prisma.restaurant.findMany({
            where: {
                codigoCliente: null
            },
            orderBy: {
                createdAt: 'asc'
            },
            select: {
                id: true,
                name: true
            }
        });

        if (restaurantsWithoutCode.length === 0) {
            return { success: true, generated: 0 };
        }

        const maxCodigo = await prisma.restaurant.findFirst({
            where: {
                codigoCliente: {
                    not: null
                }
            },
            orderBy: {
                codigoCliente: 'desc'
            },
            select: {
                codigoCliente: true
            }
        });

        let currentCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : 10000;
        let generated = 0;

        console.log(`📝 Gerando códigos para ${restaurantsWithoutCode.length} restaurantes, começando em ${currentCode}...`);

        for (const restaurant of restaurantsWithoutCode) {
            while (await prisma.restaurant.findFirst({
                where: { codigoCliente: currentCode }
            })) {
                currentCode++;
            }

            await prisma.restaurant.update({
                where: { id: restaurant.id },
                data: { codigoCliente: currentCode }
            });

            generated++;
            if (generated % 100 === 0) {
                console.log(`   ✅ ${generated} códigos gerados...`);
            }

            currentCode++;
        }

        console.log(`✅ Total de ${generated} códigos gerados!`);

        return { success: true, generated };

    } catch (error: any) {
        console.error('Erro ao gerar códigos:', error);
        return {
            success: false,
            generated: 0,
            error: error.message || 'Erro ao gerar códigos de cliente'
        };
    }
}

// Verificar status dos códigos de cliente
export async function checkCodigoClienteStatus(): Promise<{ total: number; withCode: number; withoutCode: number; nextCode: number }> {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        const total = await prisma.restaurant.count();
        const withCode = await prisma.restaurant.count({
            where: {
                codigoCliente: {
                    not: null
                }
            }
        });
        const withoutCode = total - withCode;

        const maxCodigo = await prisma.restaurant.findFirst({
            where: {
                codigoCliente: {
                    not: null
                }
            },
            orderBy: {
                codigoCliente: 'desc'
            },
            select: {
                codigoCliente: true
            }
        });

        const nextCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : 10000;

        return {
            total,
            withCode,
            withoutCode,
            nextCode
        };

    } catch (error: any) {
        console.error('Erro ao verificar status:', error);
        return {
            total: 0,
            withCode: 0,
            withoutCode: 0,
            nextCode: 10000
        };
    }
}

export { getNextCodigoCliente, createSystemNotification };
