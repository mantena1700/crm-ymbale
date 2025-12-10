'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { generateEmailWithAI } from '@/lib/openai-service';

export interface CampaignData {
    name: string;
    description?: string;
    type: 'email' | 'sms' | 'linkedin';
    status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
    subject?: string;
    content?: string;
    templateId?: string;
    scheduledAt?: string;
    segmentCriteria?: {
        status?: string[];
        potential?: string[];
        city?: string[];
        seller?: string[];
        neighborhood?: string[];
    };
    autoFollowUp?: boolean;
    followUpDays?: number;
    workflowSteps?: any[];
    aiGenerated?: boolean;
    aiPrompt?: string;
}

// Buscar todas as campanhas
export async function getCampaigns() {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                recipients: {
                    select: {
                        status: true
                    }
                },
                template: {
                    select: {
                        name: true
                    }
                }
            }
        });

        return campaigns.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            type: c.type,
            status: c.status,
            subject: c.subject,
            content: c.content,
            scheduledAt: c.scheduledAt?.toISOString(),
            startedAt: c.startedAt?.toISOString(),
            endedAt: c.endedAt?.toISOString(),
            totalRecipients: c.totalRecipients,
            sentCount: c.sentCount,
            deliveredCount: c.deliveredCount,
            openedCount: c.openedCount,
            clickedCount: c.clickedCount,
            convertedCount: c.convertedCount,
            segmentCriteria: c.segmentCriteria as any,
            autoFollowUp: c.autoFollowUp,
            followUpDays: c.followUpDays,
            workflowSteps: c.workflowSteps as any,
            aiGenerated: c.aiGenerated,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            recipientsCount: c.recipients.length,
            templateName: c.template?.name
        }));
    } catch (error) {
        console.error('Erro ao buscar campanhas:', error);
        return [];
    }
}

// Buscar campanha por ID
export async function getCampaignById(id: string) {
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                recipients: {
                    include: {
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                                address: true,
                                status: true,
                                salesPotential: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                template: true
            }
        });

        if (!campaign) return null;

        return {
            ...campaign,
            scheduledAt: campaign.scheduledAt?.toISOString(),
            startedAt: campaign.startedAt?.toISOString(),
            endedAt: campaign.endedAt?.toISOString(),
            segmentCriteria: campaign.segmentCriteria as any,
            workflowSteps: campaign.workflowSteps as any,
            createdAt: campaign.createdAt.toISOString(),
            updatedAt: campaign.updatedAt.toISOString()
        };
    } catch (error) {
        console.error('Erro ao buscar campanha:', error);
        return null;
    }
}

// Criar campanha
export async function createCampaign(data: CampaignData) {
    try {
        const campaign = await prisma.campaign.create({
            data: {
                name: data.name,
                description: data.description,
                type: data.type,
                status: data.status,
                subject: data.subject,
                content: data.content,
                templateId: data.templateId,
                scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
                segmentCriteria: data.segmentCriteria || {},
                autoFollowUp: data.autoFollowUp || false,
                followUpDays: data.followUpDays || 7,
                workflowSteps: data.workflowSteps || [],
                aiGenerated: data.aiGenerated || false,
                aiPrompt: data.aiPrompt
            }
        });

        // Se tiver critérios de segmentação, calcular destinatários
        if (data.segmentCriteria && Object.keys(data.segmentCriteria).length > 0) {
            await calculateCampaignRecipients(campaign.id, data.segmentCriteria);
        }

        revalidatePath('/campaigns');
        return { success: true, id: campaign.id };
    } catch (error) {
        console.error('Erro ao criar campanha:', error);
        return { success: false, error: 'Erro ao criar campanha' };
    }
}

// Atualizar campanha
export async function updateCampaign(id: string, data: Partial<CampaignData>) {
    try {
        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.subject !== undefined) updateData.subject = data.subject;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.templateId !== undefined) updateData.templateId = data.templateId;
        if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
        if (data.segmentCriteria !== undefined) updateData.segmentCriteria = data.segmentCriteria;
        if (data.autoFollowUp !== undefined) updateData.autoFollowUp = data.autoFollowUp;
        if (data.followUpDays !== undefined) updateData.followUpDays = data.followUpDays;
        if (data.workflowSteps !== undefined) updateData.workflowSteps = data.workflowSteps;
        if (data.aiPrompt !== undefined) updateData.aiPrompt = data.aiPrompt;

        await prisma.campaign.update({
            where: { id },
            data: updateData
        });

        // Recalcular destinatários se critérios mudaram
        if (data.segmentCriteria) {
            await calculateCampaignRecipients(id, data.segmentCriteria);
        }

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar campanha:', error);
        return { success: false, error: 'Erro ao atualizar campanha' };
    }
}

// Deletar campanha
export async function deleteCampaign(id: string) {
    try {
        await prisma.campaign.delete({
            where: { id }
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao deletar campanha:', error);
        return { success: false, error: 'Erro ao deletar campanha' };
    }
}

// Calcular destinatários baseado nos critérios
async function calculateCampaignRecipients(campaignId: string, criteria: any) {
    try {
        // Remover destinatários existentes
        await prisma.campaignRecipient.deleteMany({
            where: { campaignId }
        });

        // Construir query de filtro
        const where: any = {};

        if (criteria.status && criteria.status.length > 0) {
            where.status = { in: criteria.status };
        }

        if (criteria.potential && criteria.potential.length > 0) {
            where.salesPotential = { in: criteria.potential };
        }

        if (criteria.city && criteria.city.length > 0) {
            where.address = {
                path: ['city'],
                string_contains: criteria.city[0] // PostgreSQL JSONB limitation
            };
        }

        if (criteria.seller && criteria.seller.length > 0) {
            where.sellerId = { in: criteria.seller };
        }

        // Buscar restaurantes que atendem aos critérios
        const restaurants = await prisma.restaurant.findMany({
            where,
            select: { id: true }
        });

        // Criar destinatários
        if (restaurants.length > 0) {
            await prisma.campaignRecipient.createMany({
                data: restaurants.map(r => ({
                    campaignId,
                    restaurantId: r.id
                }))
            });

            // Atualizar contagem total
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { totalRecipients: restaurants.length }
            });
        }

        return { count: restaurants.length };
    } catch (error) {
        console.error('Erro ao calcular destinatários:', error);
        return { count: 0 };
    }
}

// Gerar conteúdo com IA
export async function generateCampaignContentWithAI(prompt: string, restaurantData?: any) {
    try {
        const content = await generateEmailWithAI(
            restaurantData || { name: 'Cliente' },
            null,
            prompt
        );

        return { success: true, content };
    } catch (error) {
        console.error('Erro ao gerar conteúdo com IA:', error);
        return { success: false, error: 'Erro ao gerar conteúdo' };
    }
}

// Iniciar campanha
export async function startCampaign(id: string) {
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: { recipients: true }
        });

        if (!campaign) {
            return { success: false, error: 'Campanha não encontrada' };
        }

        // Atualizar status
        await prisma.campaign.update({
            where: { id },
            data: {
                status: 'active',
                startedAt: new Date()
            }
        });

        // Aqui você integraria com serviço de email (SendGrid, Mailchimp, etc)
        // Por enquanto, apenas marcamos como enviado
        const pendingRecipients = campaign.recipients.filter(r => r.status === 'pending');

        if (pendingRecipients.length > 0) {
            await prisma.campaignRecipient.updateMany({
                where: {
                    campaignId: id,
                    status: 'pending'
                },
                data: {
                    status: 'sent',
                    sentAt: new Date()
                }
            });

            await prisma.campaign.update({
                where: { id },
                data: {
                    sentCount: pendingRecipients.length
                }
            });
        }

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao iniciar campanha:', error);
        return { success: false, error: 'Erro ao iniciar campanha' };
    }
}

// Pausar campanha
export async function pauseCampaign(id: string) {
    try {
        await prisma.campaign.update({
            where: { id },
            data: { status: 'paused' }
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao pausar campanha:', error);
        return { success: false, error: 'Erro ao pausar campanha' };
    }
}

// Finalizar campanha
export async function completeCampaign(id: string) {
    try {
        await prisma.campaign.update({
            where: { id },
            data: {
                status: 'completed',
                endedAt: new Date()
            }
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao finalizar campanha:', error);
        return { success: false, error: 'Erro ao finalizar campanha' };
    }
}

// Buscar templates
export async function getEmailTemplates() {
    try {
        const templates = await prisma.emailTemplate.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return templates.map(t => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            content: t.content,
            variables: t.variables as string[],
            category: t.category,
            isDefault: t.isDefault,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString()
        }));
    } catch (error) {
        console.error('Erro ao buscar templates:', error);
        return [];
    }
}

// Buscar template por ID
export async function getEmailTemplateById(id: string) {
    try {
        const template = await prisma.emailTemplate.findUnique({
            where: { id }
        });

        if (!template) return null;

        return {
            id: template.id,
            name: template.name,
            subject: template.subject,
            content: template.content,
            variables: template.variables as string[],
            category: template.category,
            isDefault: template.isDefault,
            createdAt: template.createdAt.toISOString(),
            updatedAt: template.updatedAt.toISOString()
        };
    } catch (error) {
        console.error('Erro ao buscar template:', error);
        return null;
    }
}

// Criar template
export async function createEmailTemplate(data: {
    name: string;
    subject?: string;
    content: string;
    variables?: string[];
    category?: string;
    isDefault?: boolean;
}) {
    try {
        // Se for default, remover default dos outros
        if (data.isDefault) {
            await prisma.emailTemplate.updateMany({
                where: { isDefault: true },
                data: { isDefault: false }
            });
        }

        const template = await prisma.emailTemplate.create({
            data: {
                name: data.name,
                subject: data.subject,
                content: data.content,
                variables: data.variables || [],
                category: data.category || 'custom',
                isDefault: data.isDefault || false
            }
        });

        revalidatePath('/campaigns');
        return { success: true, id: template.id };
    } catch (error) {
        console.error('Erro ao criar template:', error);
        return { success: false, error: 'Erro ao criar template' };
    }
}

// Atualizar template
export async function updateEmailTemplate(id: string, data: {
    name?: string;
    subject?: string;
    content?: string;
    variables?: string[];
    category?: string;
    isDefault?: boolean;
}) {
    try {
        // Se for default, remover default dos outros
        if (data.isDefault) {
            await prisma.emailTemplate.updateMany({
                where: {
                    isDefault: true,
                    id: { not: id }
                },
                data: { isDefault: false }
            });
        }

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.subject !== undefined) updateData.subject = data.subject;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.variables !== undefined) updateData.variables = data.variables;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

        await prisma.emailTemplate.update({
            where: { id },
            data: updateData
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar template:', error);
        return { success: false, error: 'Erro ao atualizar template' };
    }
}

// Deletar template
export async function deleteEmailTemplate(id: string) {
    try {
        await prisma.emailTemplate.delete({
            where: { id }
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao deletar template:', error);
        return { success: false, error: 'Erro ao deletar template' };
    }
}

// Aplicar template a uma campanha
export async function applyTemplateToCampaign(campaignId: string, templateId: string) {
    try {
        const template = await prisma.emailTemplate.findUnique({
            where: { id: templateId }
        });

        if (!template) {
            return { success: false, error: 'Template não encontrado' };
        }

        await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                templateId: templateId,
                subject: template.subject || undefined,
                content: template.content
            }
        });

        revalidatePath('/campaigns');
        return { success: true };
    } catch (error) {
        console.error('Erro ao aplicar template:', error);
        return { success: false, error: 'Erro ao aplicar template' };
    }
}

