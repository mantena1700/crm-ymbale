import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { restaurantId, sellerId } = await request.json();

        if (!restaurantId) {
            return NextResponse.json(
                { error: 'Restaurant ID é obrigatório' },
                { status: 400 }
            );
        }

        await prisma.restaurant.update({
            where: { id: restaurantId },
            data: {
                sellerId: sellerId || null
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Erro ao atribuir restaurante:', error);
        return NextResponse.json(
            { error: error.message || 'Erro ao atribuir restaurante' },
            { status: 500 }
        );
    }
}

