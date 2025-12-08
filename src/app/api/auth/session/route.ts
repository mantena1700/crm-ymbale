import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session_token')?.value;

        if (!token) {
            return NextResponse.json({ authenticated: false });
        }

        const user = await validateSession(token);

        if (!user) {
            // Limpar cookie inválido
            cookieStore.delete('session_token');
            return NextResponse.json({ authenticated: false });
        }

        return NextResponse.json({
            authenticated: true,
            user,
            mustChangePassword: user.mustChangePassword
        });
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        return NextResponse.json({ authenticated: false });
    }
}

