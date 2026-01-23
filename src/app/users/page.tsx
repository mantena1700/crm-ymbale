import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import UsersClient from './UsersClient';
import { getUsers } from './actions';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    // Verificar autenticação e permissão de admin
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
        redirect('/login');
    }

    const user = await validateSession(token);

    if (!user) {
        redirect('/login');
    }

    // Buscar permissões com tratamento de erro
    let permissions: string[] = [];
    try {
        const { getUserPermissionsById } = await import('./permissions-actions');
        permissions = await getUserPermissionsById(user.id);
    } catch (error) {
        console.error('Erro ao buscar permissões:', error);
        // Em caso de erro, apenas admin passa
    }

    // Acesso permitido se for admin OU tiver permissão de visualizar usuários
    const hasAccess = user.role === 'admin' || permissions.includes('users.view');

    if (!hasAccess) {
        redirect('/');
    }

    const users = await getUsers();

    // Filtrar: se não é admin, não vê admins
    // Isso impede que um usuário com permissão de editar usuários edite o admin
    const filteredUsers = user.role === 'admin'
        ? users
        : users.filter(u => u.role !== 'admin');

    return <UsersClient initialUsers={filteredUsers} currentUserId={user.id} currentUserRole={user.role as 'admin' | 'user'} />;
}

