import { NextResponse } from 'next/server';
import { initializeWhatsApp } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const status = await initializeWhatsApp();
        return NextResponse.json(status);
    } catch (error: any) {
        return NextResponse.json(
            { 
                connected: false, 
                status: 'disconnected',
                error: error.message || 'Erro ao conectar WhatsApp'
            },
            { status: 500 }
        );
    }
}

