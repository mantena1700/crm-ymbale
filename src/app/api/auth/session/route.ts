import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session_token')?.value;

        if (!token) {
            return NextResponse.json({ authenticated: false }, {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                }
            });
        }

        const user = await validateSession(token);

        if (!user) {
            // Limpar cookie inválido
            cookieStore.delete('session_token');
            return NextResponse.json({ authenticated: false }, {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                }
            });
        }

        // Buscar permissões DIRETAMENTE do banco (sem cache)
        const { prisma } = await import('@/lib/db');
        const { ALL_PERMISSIONS } = await import('@/lib/permissions');

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                userPermissions: {
                    include: { permission: true }
                }
            }
        });

        let permissions: string[] = [];

        if (dbUser) {
            if (dbUser.role === 'admin' || dbUser.role === 'root') {
                permissions = Object.keys(ALL_PERMISSIONS);
            } else {
                permissions = dbUser.userPermissions.map(up => up.permission.code);
            }
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                ...user,
                permissions
            },
            mustChangePassword: user.mustChangePassword
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            }
        });
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        return NextResponse.json({ authenticated: false }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            }
        });
    }
}
