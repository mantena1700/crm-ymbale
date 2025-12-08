'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getNotifications() {
    try {
        const notifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return notifications.map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            read: n.read ?? false,
            metadata: n.metadata as any,
            createdAt: n.createdAt?.toISOString() || new Date().toISOString(),
        }));
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        return [];
    }
}

export async function markAsRead(id: string) {
    try {
        await prisma.notification.update({
            where: { id },
            data: { read: true }
        });
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error('Erro ao marcar como lida:', error);
        return { success: false };
    }
}

export async function markAllAsRead() {
    try {
        await prisma.notification.updateMany({
            where: { read: false },
            data: { read: true }
        });
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error('Erro ao marcar todas como lidas:', error);
        return { success: false };
    }
}

export async function deleteNotification(id: string) {
    try {
        await prisma.notification.delete({
            where: { id }
        });
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error('Erro ao excluir notificação:', error);
        return { success: false };
    }
}

export async function clearAllNotifications() {
    try {
        await prisma.notification.deleteMany({});
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error('Erro ao limpar notificações:', error);
        return { success: false };
    }
}

export async function createNotification(data: {
    type: string;
    title: string;
    message: string;
    metadata?: any;
}) {
    try {
        const notification = await prisma.notification.create({
            data: {
                type: data.type,
                title: data.title,
                message: data.message,
                metadata: data.metadata || {},
                read: false,
            }
        });
        revalidatePath('/notifications');
        return { success: true, notification };
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
        return { success: false };
    }
}

export async function getUnreadCount() {
    try {
        const count = await prisma.notification.count({
            where: { read: false }
        });
        return count;
    } catch (error) {
        console.error('Erro ao contar notificações:', error);
        return 0;
    }
}

