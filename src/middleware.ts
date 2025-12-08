import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas públicas que não precisam de autenticação
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/session'];

// Rotas que só admins podem acessar
const adminOnlyRoutes = ['/users', '/api/users'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Permitir assets estáticos
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Verificar se é rota pública
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Verificar token de sessão
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
        // Redirecionar para login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Para rotas de admin, verificar role via API
    if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
        try {
            const sessionResponse = await fetch(new URL('/api/auth/session', request.url), {
                headers: {
                    Cookie: `session_token=${token}`
                }
            });
            
            const session = await sessionResponse.json();
            
            if (!session.authenticated || session.user?.role !== 'admin') {
                // Redirecionar para home se não for admin
                return NextResponse.redirect(new URL('/', request.url));
            }
        } catch (error) {
            // Em caso de erro, permitir (a página fará a verificação)
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
};

