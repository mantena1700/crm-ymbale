import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import UsersClient from './UsersClient';
import { getUsers } from './actions';

export default async function UsersPage() {
    // Verificar autenticação e permissão de admin
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
        redirect('/login');
    }

    const user = await validateSession(token);
    
    if (!user || user.role !== 'admin') {
        redirect('/');
    }

    const users = await getUsers();

    return <UsersClient initialUsers={users} currentUserId={user.id} />;
}

