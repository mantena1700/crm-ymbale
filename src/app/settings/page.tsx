import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
        redirect('/login');
    }

    const user = await validateSession(token);

    if (!user) {
        redirect('/login');
    }

    // Buscar permissões
    const { getUserPermissionsById } = await import('@/app/users/permissions-actions');
    const permissions = await getUserPermissionsById(user.id);

    // Acesso permitido se for admin OU tiver permissão de visualizar configurações
    const hasAccess = user.role === 'admin' || permissions.includes('settings.view');

    if (!hasAccess) {
        redirect('/');
    }

    return <SettingsClient />;
}
