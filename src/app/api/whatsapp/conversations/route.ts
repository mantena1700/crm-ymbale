import { NextResponse } from 'next/server';
import { getWhatsAppConversations } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const conversations = await getWhatsAppConversations();
        return NextResponse.json({ conversations });
    } catch (error: any) {
        return NextResponse.json(
            { conversations: [], error: error.message || 'Erro ao obter conversas' },
            { status: 500 }
        );
    }
}

