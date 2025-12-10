import { NextResponse } from 'next/server';
import { disconnectWhatsApp } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        await disconnectWhatsApp();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro ao desconectar' },
            { status: 500 }
        );
    }
}

