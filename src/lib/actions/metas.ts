'use server';

import { revalidatePath } from 'next/cache';
import { saveGoal, getGoals } from '@/lib/db-data';

// Atualizar meta
export async function updateGoal(goalId: string, current: number) {
    const goals = await getGoals();
    const goal = goals.find(g => g.id === goalId);

    if (goal) {
        goal.current = current;
        if (current >= goal.target) {
            goal.status = 'completed';
        }
        await saveGoal(goal);
    }

    revalidatePath('/goals');
    return { success: true };
}
