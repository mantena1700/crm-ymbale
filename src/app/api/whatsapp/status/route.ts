import { NextResponse } from 'next/server';
import { getWhatsAppStatus } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const status = await getWhatsAppStatus();
        return NextResponse.json(status);
    } catch (error: any) {
        return NextResponse.json(
            { 
                connected: false, 
                status: 'disconnected',
                error: error.message || 'Erro ao obter status'
            },
            { status: 500 }
        );
    }
}

