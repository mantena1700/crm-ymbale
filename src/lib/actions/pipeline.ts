'use server';

import { revalidatePath } from 'next/cache';
import { saveFollowUp, getFollowUps } from '@/lib/db-data';
import { FollowUp } from '@/lib/types';

// Criar follow-up
export async function createFollowUp(restaurantId: string, type: 'email' | 'call' | 'meeting', scheduledDate: string, emailSubject?: string, emailBody?: string) {
    const followUp: FollowUp = {
        id: Date.now().toString(),
        restaurantId,
        type,
        scheduledDate,
        completed: false,
        emailSubject,
        emailBody,
        emailSent: false
    };

    await saveFollowUp(followUp);
    revalidatePath('/pipeline');
    revalidatePath(`/restaurant/${restaurantId}`);
    return followUp;
}

// Enviar email
export async function sendEmail(restaurantId: string, subject: string, body: string) {
    const followUps = await getFollowUps(restaurantId);
    const followUp = followUps.find(f => f.emailSubject === subject && !f.emailSent);

    if (followUp) {
        followUp.emailSent = true;
        followUp.completed = true;
        followUp.completedDate = new Date().toISOString();
        await saveFollowUp(followUp);
    }

    revalidatePath('/pipeline');
    revalidatePath(`/restaurant/${restaurantId}`);
    return { success: true, message: 'Email enviado com sucesso!' };
}

// Completar follow-up
export async function completeFollowUp(followUpId: string) {
    const followUps = await getFollowUps();
    const followUp = followUps.find(f => f.id === followUpId);

    if (followUp) {
        followUp.completed = true;
        followUp.completedDate = new Date().toISOString();
        await saveFollowUp(followUp);
    }

    revalidatePath('/pipeline');
    return { success: true };
}
