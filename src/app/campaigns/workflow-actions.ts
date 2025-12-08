'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { createFollowUp } from '@/app/actions';

export interface WorkflowData {
    name: string;
    description?: string;
    triggerType: 'status_change' | 'new_lead' | 'no_contact_days' | 'rating_threshold' | 'manual';
    triggerConditions?: {
        status?: string[];
        potential?: string[];
        minRating?: number;
        daysWithoutContact?: number;
        [key: string]: any;
    };
    steps: Array<{
        type: 'send_email' | 'create_followup' | 'assign_seller' | 'update_status' | 'create_note';
        delay?: number; // dias
        config?: any;
    }>;
    active?: boolean;
}

// Buscar workflows
export async function getWorkflows() {
    try {
        const workflows = await prisma.workflow.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                executions: {
                    select: {
                        status: true
                    }
                }
            }
        });

        return workflows.map(w => ({
            id: w.id,
            name: w.name,
            description: w.description,
            triggerType: w.triggerType,
            triggerConditions: w.triggerConditions as any,
            steps: w.steps as any[],
            active: w.active,
            executionCount: w.executionCount,
            lastExecutedAt: w.lastExecutedAt?.toISOString(),
            createdAt: w.createdAt.toISOString(),
            updatedAt: w.updatedAt.toISOString(),
            runningExecutions: w.executions.filter(e => e.status === 'running').length
        }));
    } catch (error) {
        console.error('Erro ao buscar workflows:', error);
        return [];
    }
}

// Criar workflow
export async function createWorkflow(data: WorkflowData) {
    try {
        const workflow = await prisma.workflow.create({
            data: {
                name: data.name,
                description: data.description,
                triggerType: data.triggerType,
                triggerConditions: data.triggerConditions || {},
                steps: data.steps,
                active: data.active !== false
            }
        });

        revalidatePath('/campaigns');
        return { success: true, id: workflow.id };
    } catch (error) {
        console.error('Erro ao criar workflow:', error);
        return { success: false, error: 'Erro ao criar workflow' };
    }
}

// Atualizar workflow
export async function updateWorkflow(id: string, data: Partial<WorkflowData>) {
    try {
        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
        if (data.triggerConditions !== undefined) updateData.triggerConditions = data.triggerConditions;
        if (data.steps !== undefined) updateData.steps = data.steps;
        if (data.active !== undefined) updateData.active = data.active;

        await prisma.workflow.update({
            where: { id },
            data: updateData
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar workflow:', error);
        return { success: false, error: 'Erro ao atualizar workflow' };
    }
}

// Deletar workflow
export async function deleteWorkflow(id: string) {
    try {
        await prisma.workflow.delete({
            where: { id }
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao deletar workflow:', error);
        return { success: false, error: 'Erro ao deletar workflow' };
    }
}

// Executar workflow manualmente
export async function executeWorkflow(workflowId: string, restaurantId: string) {
    try {
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId }
        });

        if (!workflow || !workflow.active) {
            return { success: false, error: 'Workflow não encontrado ou inativo' };
        }

        // Criar execução
        const execution = await prisma.workflowExecution.create({
            data: {
                workflowId,
                restaurantId,
                status: 'running',
                currentStep: 0,
                stepsCompleted: []
            }
        });

        // Executar steps
        const steps = workflow.steps as any[];
        const completedSteps: any[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];

            try {
                // Aguardar delay se houver
                if (step.delay && step.delay > 0) {
                    // Em produção, você usaria um job queue (Bull, Agenda, etc)
                    // Por enquanto, apenas registramos o delay
                }

                // Executar ação
                switch (step.type) {
                    case 'send_email':
                        // Integrar com serviço de email
                        break;

                    case 'create_followup':
                        await createFollowUp(
                            restaurantId,
                            'email',
                            new Date(Date.now() + (step.delay || 0) * 24 * 60 * 60 * 1000).toISOString(),
                            step.config?.notes || 'Follow-up automático do workflow'
                        );
                        break;

                    case 'update_status':
                        await prisma.restaurant.update({
                            where: { id: restaurantId },
                            data: { status: step.config?.status || 'Contatado' }
                        });
                        break;

                    case 'assign_seller':
                        if (step.config?.sellerId) {
                            await prisma.restaurant.update({
                                where: { id: restaurantId },
                                data: {
                                    sellerId: step.config.sellerId,
                                    assignedAt: new Date()
                                }
                            });
                        }
                        break;

                    case 'create_note':
                        await prisma.note.create({
                            data: {
                                restaurantId,
                                content: step.config?.content || 'Nota criada automaticamente pelo workflow'
                            }
                        });
                        break;
                }

                completedSteps.push({
                    step: i,
                    type: step.type,
                    completedAt: new Date().toISOString()
                });

                // Atualizar execução
                await prisma.workflowExecution.update({
                    where: { id: execution.id },
                    data: {
                        currentStep: i + 1,
                        stepsCompleted: completedSteps
                    }
                });
            } catch (stepError) {
                console.error(`Erro ao executar step ${i}:`, stepError);
                // Continuar com próximo step
            }
        }

        // Finalizar execução
        await prisma.workflowExecution.update({
            where: { id: execution.id },
            data: {
                status: 'completed',
                completedAt: new Date(),
                stepsCompleted: completedSteps
            }
        });

        // Atualizar contador do workflow
        await prisma.workflow.update({
            where: { id: workflowId },
            data: {
                executionCount: { increment: 1 },
                lastExecutedAt: new Date()
            }
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao executar workflow:', error);
        return { success: false, error: 'Erro ao executar workflow' };
    }
}

// Verificar e executar workflows automáticos
export async function checkAndExecuteWorkflows(restaurantId: string, triggerData?: any) {
    try {
        const workflows = await prisma.workflow.findMany({
            where: { active: true }
        });

        for (const workflow of workflows) {
            const conditions = workflow.triggerConditions as any;
            let shouldExecute = false;

            // Verificar condições baseado no tipo de trigger
            switch (workflow.triggerType) {
                case 'status_change':
                    if (triggerData?.status && conditions.status?.includes(triggerData.status)) {
                        shouldExecute = true;
                    }
                    break;

                case 'new_lead':
                    // Sempre executar para novos leads
                    shouldExecute = true;
                    break;

                case 'no_contact_days':
                    // Verificar último contato
                    const lastFollowUp = await prisma.followUp.findFirst({
                        where: { restaurantId },
                        orderBy: { scheduledDate: 'desc' }
                    });

                    if (lastFollowUp) {
                        const daysSince = Math.floor(
                            (Date.now() - lastFollowUp.scheduledDate.getTime()) / (1000 * 60 * 60 * 24)
                        );

                        if (daysSince >= (conditions.daysWithoutContact || 30)) {
                            shouldExecute = true;
                        }
                    }
                    break;

                case 'rating_threshold':
                    const restaurant = await prisma.restaurant.findUnique({
                        where: { id: restaurantId },
                        select: { rating: true }
                    });

                    if (restaurant?.rating && Number(restaurant.rating) >= (conditions.minRating || 4.0)) {
                        shouldExecute = true;
                    }
                    break;
            }

            if (shouldExecute) {
                await executeWorkflow(workflow.id, restaurantId);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Erro ao verificar workflows:', error);
        return { success: false };
    }
}

