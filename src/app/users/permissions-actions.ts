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

        // Se admin, tem todas
        if (user.role === 'admin') {
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
export async function updateUserPermissions(
    userId: string,
    permissions: string[],
    grantedBy?: string
): Promise<{ success: boolean; message: string }> {
    try {
        // Primeiro, garantir que todas as permissões existam no banco
        for (const code of permissions) {
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
            where: { code: { in: permissions } }
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
    role: 'admin' | 'user'
): Promise<{ success: boolean; message: string }> {
    try {
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
