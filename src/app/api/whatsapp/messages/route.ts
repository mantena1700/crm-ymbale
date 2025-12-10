import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppMessages, sendWhatsAppMessage } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const phoneNumber = searchParams.get('phoneNumber');
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!phoneNumber) {
            return NextResponse.json(
                { error: 'phoneNumber é obrigatório' },
                { status: 400 }
            );
        }

        const messages = await getWhatsAppMessages(phoneNumber, limit);
        return NextResponse.json({ messages });
    } catch (error: any) {
        return NextResponse.json(
            { messages: [], error: error.message || 'Erro ao obter mensagens' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phoneNumber, message, restaurantId } = body;

        if (!phoneNumber || !message) {
            return NextResponse.json(
                { error: 'phoneNumber e message são obrigatórios' },
                { status: 400 }
            );
        }

        const result = await sendWhatsAppMessage(phoneNumber, message, restaurantId);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao enviar mensagem' },
            { status: 500 }
        );
    }
}

