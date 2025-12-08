'use server';

import { getGoals as getGoalsData, getDashboardStats as getDashboardStatsData, getIntelligentSegmentation as getIntelligentSegmentationData, saveGoal as saveGoalData } from '@/lib/db-data';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { Goal } from '@/lib/types';

export async function getGoals() {
    return await getGoalsData();
}

export async function getDashboardStats() {
    return await getDashboardStatsData();
}

export async function getIntelligentSegmentation() {
    return await getIntelligentSegmentationData();
}

export async function createGoal(data: Omit<Goal, 'id'>) {
    const goal: Goal = {
        id: `goal-${Date.now()}`,
        ...data
    };
    
    await saveGoalData(goal);
    revalidatePath('/goals');
    revalidatePath('/');
    return goal;
}

export async function updateGoal(id: string, data: Partial<Goal>) {
    try {
        await prisma.goal.update({
            where: { id },
            data: {
                name: data.name,
                type: data.type,
                target: data.target,
                current: data.current,
                period: data.period,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
                status: data.status,
            }
        });
        revalidatePath('/goals');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar meta:', error);
        return { success: false };
    }
}

export async function deleteGoal(id: string) {
    try {
        await prisma.goal.delete({
            where: { id }
        });
        revalidatePath('/goals');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Erro ao excluir meta:', error);
        return { success: false };
    }
}

export async function updateGoalProgress(id: string, current: number) {
    try {
        const goal = await prisma.goal.findUnique({ where: { id } });
        if (!goal) return { success: false };
        
        const target = Number(goal.target);
        const progress = (current / target) * 100;
        
        // Determinar status baseado no progresso
        let status = 'active';
        if (progress >= 100) {
            status = 'completed';
        } else if (new Date(goal.endDate) < new Date()) {
            status = progress >= 80 ? 'completed' : 'failed';
        }
        
        await prisma.goal.update({
            where: { id },
            data: { 
                current,
                status
            }
        });
        
        revalidatePath('/goals');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar progresso:', error);
        return { success: false };
    }
}

