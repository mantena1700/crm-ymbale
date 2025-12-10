import { NextResponse } from 'next/server';
import { getGoogleMapsApiKey } from '@/app/settings/api-keys-actions';

export async function GET() {
    try {
        const apiKey = await getGoogleMapsApiKey();
        return NextResponse.json({ apiKey });
    } catch (error) {
        console.error('Erro ao buscar Google Maps API Key:', error);
        return NextResponse.json({ apiKey: null }, { status: 500 });
    }
}

