'use server';

import { prisma } from '@/lib/db';
import { hashPassword, generateRandomPassword } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface UserData {
    id: string;
    username: string;
    name: string;
    email: string | null;
    role: 'admin' | 'user';
    active: boolean;
    locked: boolean;
    mustChangePassword: boolean;
    loginAttempts: number;
    lastLogin: string | null;
    createdAt: string;
}

export async function getUsers(): Promise<UserData[]> {
    try {
        const users = await prisma.user.findMany({
            orderBy: [
                { role: 'asc' },
                { name: 'asc' }
            ]
        });

        return users.map(u => ({
            id: u.id,
            username: u.username,
            name: u.name,
            email: u.email,
            role: u.role as 'admin' | 'user',
            active: u.active,
            locked: u.lockedUntil !== null,
            mustChangePassword: (u as any).mustChangePassword || false,
            loginAttempts: u.loginAttempts,
            lastLogin: u.lastLogin?.toISOString() || null,
            createdAt: u.createdAt.toISOString()
        }));
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        return [];
    }
}

export async function createUser(data: {
    username: string;
    name: string;
    email?: string;
    password: string;
    role: 'admin' | 'user';
}) {
    try {
        // Verificar se username já existe
        const existing = await prisma.user.findUnique({
            where: { username: data.username.toLowerCase() }
        });

        if (existing) {
            return { success: false, error: 'Nome de usuário já existe' };
        }

        // Verificar email duplicado
        if (data.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: data.email.toLowerCase() }
            });
            if (emailExists) {
                return { success: false, error: 'Email já está em uso' };
            }
        }

        // Hash da senha
        const hashedPassword = await hashPassword(data.password);

        // Criar usuário
        const user = await prisma.user.create({
            data: {
                username: data.username.toLowerCase(),
                name: data.name,
                email: data.email?.toLowerCase() || null,
                password: hashedPassword,
                role: data.role,
                active: true
            }
        });

        revalidatePath('/users');

        return { 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                name: user.name
            }
        };
    } catch (error: any) {
        console.error('Erro ao criar usuário:', error);
        return { success: false, error: 'Erro ao criar usuário' };
    }
}

export async function updateUser(id: string, data: {
    name?: string;
    email?: string;
    role?: 'admin' | 'user';
    active?: boolean;
    password?: string;
}) {
    try {
        const updateData: any = {};

        if (data.name) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email?.toLowerCase() || null;
        if (data.role) updateData.role = data.role;
        if (data.active !== undefined) updateData.active = data.active;
        
        if (data.password) {
            updateData.password = await hashPassword(data.password);
        }

        await prisma.user.update({
            where: { id },
            data: updateData
        });

        revalidatePath('/users');

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao atualizar usuário:', error);
        return { success: false, error: 'Erro ao atualizar usuário' };
    }
}

export async function deleteUser(id: string, currentUserId: string) {
    try {
        // Não permitir deletar a si mesmo
        if (id === currentUserId) {
            return { success: false, error: 'Você não pode excluir sua própria conta' };
        }

        // Verificar se é o único admin
        const admins = await prisma.user.count({
            where: { role: 'admin', active: true }
        });

        const userToDelete = await prisma.user.findUnique({
            where: { id }
        });

        if (userToDelete?.role === 'admin' && admins <= 1) {
            return { success: false, error: 'Não é possível excluir o último administrador' };
        }

        // Deletar sessões do usuário
        await prisma.session.deleteMany({
            where: { userId: id }
        });

        // Deletar usuário
        await prisma.user.delete({
            where: { id }
        });

        revalidatePath('/users');

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao excluir usuário:', error);
        return { success: false, error: 'Erro ao excluir usuário' };
    }
}

export async function toggleUserStatus(id: string, currentUserId: string) {
    try {
        if (id === currentUserId) {
            return { success: false, error: 'Você não pode desativar sua própria conta' };
        }

        const user = await prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            return { success: false, error: 'Usuário não encontrado' };
        }

        // Se for desativar um admin, verificar se é o último
        if (user.active && user.role === 'admin') {
            const activeAdmins = await prisma.user.count({
                where: { role: 'admin', active: true }
            });
            if (activeAdmins <= 1) {
                return { success: false, error: 'Não é possível desativar o último administrador' };
            }
        }

        // Toggle status
        await prisma.user.update({
            where: { id },
            data: { active: !user.active }
        });

        // Se desativando, encerrar sessões
        if (user.active) {
            await prisma.session.deleteMany({
                where: { userId: id }
            });
        }

        revalidatePath('/users');

        return { success: true, active: !user.active };
    } catch (error: any) {
        console.error('Erro ao alterar status:', error);
        return { success: false, error: 'Erro ao alterar status' };
    }
}

export async function resetPassword(id: string, newPassword: string) {
    try {
        if (newPassword.length < 4) {
            return { success: false, error: 'Senha deve ter no mínimo 4 caracteres' };
        }

        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id },
            data: { 
                password: hashedPassword,
                loginAttempts: 0,
                lockedUntil: null
            }
        });

        // Encerrar todas as sessões do usuário
        await prisma.session.deleteMany({
            where: { userId: id }
        });

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao resetar senha:', error);
        return { success: false, error: 'Erro ao resetar senha' };
    }
}

// Desbloquear usuário e gerar senha aleatória
export async function unlockUserAndResetPassword(id: string, currentUserId: string) {
    try {
        // Verificar se o usuário atual é admin
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId }
        });

        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, error: 'Apenas administradores podem desbloquear contas' };
        }

        // Buscar usuário a ser desbloqueado
        const user = await prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            return { success: false, error: 'Usuário não encontrado' };
        }

        // Gerar nova senha aleatória
        const newPassword = generateRandomPassword(10);
        const hashedPassword = await hashPassword(newPassword);

        // Desbloquear e atualizar senha
        await prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
                loginAttempts: 0,
                lockedUntil: null,
                mustChangePassword: true // Força troca de senha
            }
        });

        // Encerrar todas as sessões do usuário
        await prisma.session.deleteMany({
            where: { userId: id }
        });

        // Criar notificação de desbloqueio
        await prisma.notification.create({
            data: {
                type: 'info',
                title: '🔓 Conta Desbloqueada',
                message: `A conta de "${user.name}" (@${user.username}) foi desbloqueada e uma nova senha foi gerada.`,
                metadata: {
                    userId: user.id,
                    unlockedBy: currentUserId
                }
            }
        });

        revalidatePath('/users');
        revalidatePath('/notifications');

        return { 
            success: true, 
            newPassword,
            message: `Conta desbloqueada! Nova senha: ${newPassword}`
        };
    } catch (error: any) {
        console.error('Erro ao desbloquear usuário:', error);
        return { success: false, error: 'Erro ao desbloquear usuário' };
    }
}

// Alterar própria senha (para quando mustChangePassword = true)
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return { success: false, error: 'Usuário não encontrado' };
        }

        // Verificar senha atual
        const bcrypt = await import('bcryptjs');
        const isValid = await bcrypt.compare(currentPassword, user.password);

        if (!isValid) {
            return { success: false, error: 'Senha atual incorreta' };
        }

        if (newPassword.length < 6) {
            return { success: false, error: 'Nova senha deve ter no mínimo 6 caracteres' };
        }

        // Não permitir mesma senha
        const isSame = await bcrypt.compare(newPassword, user.password);
        if (isSame) {
            return { success: false, error: 'A nova senha não pode ser igual à anterior' };
        }

        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                mustChangePassword: false
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao alterar senha:', error);
        return { success: false, error: 'Erro ao alterar senha' };
    }
}

