import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session_token')?.value;

        if (token) {
            await destroySession(token);
        }

        // Remover cookie
        cookieStore.delete('session_token');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erro no logout:', error);
        return NextResponse.json({ success: true }); // Retorna sucesso mesmo com erro
    }
}

