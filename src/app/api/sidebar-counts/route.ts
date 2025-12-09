import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        // Buscar notificações não lidas
        const unreadNotifications = await prisma.notification.count({
            where: { read: false }
        });

        // Buscar follow-ups pendentes (hoje ou atrasados)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const pendingFollowUps = await prisma.followUp.count({
            where: {
                completed: false,
                scheduledDate: {
                    lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Até amanhã
                }
            }
        });

        return NextResponse.json({
            notifications: unreadNotifications,
            pendingFollowUps: pendingFollowUps
        });
    } catch (error) {
        console.error('Erro ao buscar contadores:', error);
        return NextResponse.json({
            notifications: 0,
            pendingFollowUps: 0
        });
    }
}
