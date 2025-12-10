import { NextRequest, NextResponse } from 'next/server';
import { moveToFunnel } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { restaurantId, newStage } = body;

        if (!restaurantId || !newStage) {
            return NextResponse.json(
                { error: 'restaurantId e newStage são obrigatórios' },
                { status: 400 }
            );
        }

        const result = await moveToFunnel(restaurantId, newStage);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao mover para funil' },
            { status: 500 }
        );
    }
}

