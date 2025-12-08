import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { success: false, error: 'Usuário e senha são obrigatórios' },
                { status: 400 }
            );
        }

        // Autenticar
        const result = await authenticateUser(username, password);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 401 }
            );
        }

        // Criar sessão
        const ipAddress = request.headers.get('x-forwarded-for') || 
                          request.headers.get('x-real-ip') || 
                          'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        const token = await createSession(result.user!.id, ipAddress, userAgent);

        // Definir cookie
        const cookieStore = await cookies();
        cookieStore.set('session_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 horas
            path: '/'
        });

        return NextResponse.json({
            success: true,
            user: result.user,
            mustChangePassword: result.mustChangePassword
        });

    } catch (error) {
        console.error('Erro no login:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

