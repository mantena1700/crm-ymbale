'use server';

import { prisma } from '@/lib/db';
import { ALL_PERMISSIONS, PermissionCode, ROLE_PERMISSIONS } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export interface UserWithPermissions {
    id: string;
    username: string;
    name: string;
    email: string | null;
    role: string;
    active: boolean;
    permissions: string[]; // códigos das permissões
}

// Buscar todos os usuários com suas permissões
export async function getUsersWithPermissions(): Promise<UserWithPermissions[]> {
    try {
        const users = await prisma.user.findMany({
            include: {
                userPermissions: {
                    include: { permission: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return users.map(user => ({
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            active: user.active,
            permissions: user.userPermissions.map(up => up.permission.code)
        }));
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        return [];
    }
}

// Buscar permissões de um usuário específico
export async function getUserPermissionsById(userId: string): Promise<string[]> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                userPermissions: {
                    include: { permission: true }
                }
            }
        });

        if (!user) return [];

        // Se admin ou root, tem todas
        if (user.role === 'admin' || user.role === 'root') {
            return Object.keys(ALL_PERMISSIONS);
        }

        // Permissões do role + específicas
        const rolePerms = ROLE_PERMISSIONS[user.role] || [];
        const specificPerms = user.userPermissions.map(up => up.permission.code);

        return [...new Set([...rolePerms, ...specificPerms])];
    } catch (error) {
        console.error('Erro ao buscar permissões:', error);
        return [];
    }
}

// Atualizar permissões de um usuário
// Permissões restritas para não-admins (DEVE estar sincronizado com o frontend)
const RESTRICTED_FOR_NON_ADMINS = [
    'sellers.delete',
    'campaigns.create',
    'campaigns.edit',
    'campaigns.delete',
    'settings.view',
    'settings.edit',
    'users.edit',
    'users.delete'
];

export async function updateUserPermissions(
    userId: string,
    permissions: string[],
    grantedBy?: string,
    userId: string,
    permissions: string[],
    grantedBy?: string,
    currentUserRole?: 'admin' | 'user' | 'root'
): Promise<{ success: boolean; message: string }> {
    try {
        // SEGURANÇA: Se não for admin/root, remover permissões restritas da lista
        // Isso impede que um usuário comum atribua permissões poderosas a si mesmo ou a outros
        let permsToSave = permissions;
        if (currentUserRole !== 'admin' && currentUserRole !== 'root') {
            permsToSave = permissions.filter(p => !RESTRICTED_FOR_NON_ADMINS.includes(p));

            // Logar tentativa de violação (opcional)
            if (permsToSave.length !== permissions.length) {
                console.warn(`[SECURITY] Usuário (role=${currentUserRole}) tentou atribuir permissões restritas. Permissões filtradas.`);
            }
        }

        // Primeiro, garantir que todas as permissões existam no banco
        for (const code of permsToSave) {
            const permDef = ALL_PERMISSIONS[code as PermissionCode];
            if (permDef) {
                await prisma.permission.upsert({
                    where: { code },
                    update: {},
                    create: {
                        code,
                        name: permDef.name,
                        module: permDef.module,
                        action: permDef.action
                    }
                });
            }
        }

        // Remover todas as permissões atuais do usuário
        await prisma.userPermission.deleteMany({
            where: { userId }
        });

        // Buscar IDs das permissões
        const permissionRecords = await prisma.permission.findMany({
            where: { code: { in: permsToSave } }
        });

        // Adicionar novas permissões
        for (const perm of permissionRecords) {
            await prisma.userPermission.create({
                data: {
                    userId,
                    permissionId: perm.id,
                    grantedBy
                }
            });
        }

        revalidatePath('/users');
        revalidatePath('/'); // Revalida dashboard para atualizar sidebar
        return { success: true, message: 'Permissões atualizadas com sucesso!' };
    } catch (error) {
        console.error('Erro ao atualizar permissões:', error);
        return { success: false, message: 'Erro ao atualizar permissões' };
    }
}

// Atualizar role do usuário
export async function updateUserRole(
    userId: string,
    userId: string,
    role: 'admin' | 'user' | 'root',
    currentUserRole?: 'admin' | 'user' | 'root' // Role do usuário fazendo a alteração
): Promise<{ success: boolean; message: string }> {
    try {
        // SEGURANÇA: Apenas admins/root podem alterar roles para admin
        if (role === 'admin' && currentUserRole !== 'admin' && currentUserRole !== 'root') {
            return { success: false, message: 'Apenas administradores podem definir outros usuários como administrador' };
        }

        // SEGURANÇA: Apenas root pode definir outros como root
        if (role === 'root' && currentUserRole !== 'root') {
            return { success: false, message: 'Apenas ROOT pode definir outros usuários como ROOT' };
        }

        // SEGURANÇA: Apenas admins/root podem alterar o role de outros admins
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (targetUser?.role === 'admin' && currentUserRole !== 'admin' && currentUserRole !== 'root') {
            return { success: false, message: 'Apenas administradores podem alterar o cargo de outros administradores' };
        }

        // SEGURANÇA: Apenas root pode alterar o role de outros roots
        if (targetUser?.role === 'root' && currentUserRole !== 'root') {
            return { success: false, message: 'Apenas ROOT pode alterar o cargo de outros usuários ROOT' };
        }

        await prisma.user.update({
            where: { id: userId },
            data: { role }
        });

        revalidatePath('/users');
        revalidatePath('/');
        return { success: true, message: 'Cargo atualizado com sucesso!' };
    } catch (error) {
        console.error('Erro ao atualizar cargo:', error);
        return { success: false, message: 'Erro ao atualizar cargo' };
    }
}

// Inicializar permissões no banco
export async function initializePermissions(): Promise<void> {
    try {
        for (const [code, def] of Object.entries(ALL_PERMISSIONS)) {
            await prisma.permission.upsert({
                where: { code },
                update: { name: def.name, module: def.module, action: def.action },
                create: { code, name: def.name, module: def.module, action: def.action }
            });
        }
        console.log('Permissões inicializadas');
    } catch (error) {
        console.error('Erro ao inicializar permissões:', error);
    }
}
