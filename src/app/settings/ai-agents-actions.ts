'use server';

import { prisma } from '@/lib/db';
import { AIAgentData, DEFAULT_AGENTS } from '@/lib/ai-agents-data';

// Buscar todos os agentes
export async function getAIAgents(): Promise<AIAgentData[]> {
    try {
        const agents = await prisma.aIAgent.findMany({
            orderBy: { name: 'asc' }
        });

        if (agents.length === 0) {
            // Retornar defaults se não tiver no banco
            return DEFAULT_AGENTS.map((a, i) => ({ ...a, id: `default-${i}` }));
        }

        return agents.map(a => ({
            id: a.id,
            code: a.code,
            name: a.name,
            description: a.description || undefined,
            systemPrompt: a.systemPrompt,
            userPromptTemplate: a.userPromptTemplate,
            model: a.model,
            temperature: Number(a.temperature),
            maxTokens: a.maxTokens,
            active: a.active,
            isDefault: a.isDefault
        }));
    } catch (error) {
        console.error('Erro ao buscar agentes:', error);
        return DEFAULT_AGENTS.map((a, i) => ({ ...a, id: `default-${i}` }));
    }
}

// Buscar agente por código
export async function getAIAgentByCode(code: string): Promise<AIAgentData | null> {
    try {
        const agent = await prisma.aIAgent.findUnique({
            where: { code }
        });

        if (!agent) {
            const defaultAgent = DEFAULT_AGENTS.find(a => a.code === code);
            return defaultAgent || null;
        }

        return {
            id: agent.id,
            code: agent.code,
            name: agent.name,
            description: agent.description || undefined,
            systemPrompt: agent.systemPrompt,
            userPromptTemplate: agent.userPromptTemplate,
            model: agent.model,
            temperature: Number(agent.temperature),
            maxTokens: agent.maxTokens,
            active: agent.active,
            isDefault: agent.isDefault
        };
    } catch (error) {
        console.error('Erro ao buscar agente:', error);
        const defaultAgent = DEFAULT_AGENTS.find(a => a.code === code);
        return defaultAgent || null;
    }
}

// Salvar/atualizar agente
export async function saveAIAgent(data: AIAgentData): Promise<{ success: boolean; message: string }> {
    try {
        await prisma.aIAgent.upsert({
            where: { code: data.code },
            update: {
                name: data.name,
                description: data.description,
                systemPrompt: data.systemPrompt,
                userPromptTemplate: data.userPromptTemplate,
                model: data.model,
                temperature: data.temperature,
                maxTokens: data.maxTokens,
                active: data.active,
                isDefault: false
            },
            create: {
                code: data.code,
                name: data.name,
                description: data.description,
                systemPrompt: data.systemPrompt,
                userPromptTemplate: data.userPromptTemplate,
                model: data.model,
                temperature: data.temperature,
                maxTokens: data.maxTokens,
                active: data.active,
                isDefault: false
            }
        });

        return { success: true, message: 'Agente salvo com sucesso!' };
    } catch (error) {
        console.error('Erro ao salvar agente:', error);
        return { success: false, message: 'Erro ao salvar agente' };
    }
}

// Resetar agente para o padrão
export async function resetAIAgentToDefault(code: string): Promise<{ success: boolean; message: string }> {
    try {
        const defaultAgent = DEFAULT_AGENTS.find(a => a.code === code);
        if (!defaultAgent) {
            return { success: false, message: 'Agente padrão não encontrado' };
        }

        await prisma.aIAgent.upsert({
            where: { code },
            update: {
                ...defaultAgent,
                isDefault: true
            },
            create: {
                ...defaultAgent,
                isDefault: true
            }
        });

        return { success: true, message: 'Agente resetado para o padrão' };
    } catch (error) {
        console.error('Erro ao resetar agente:', error);
        return { success: false, message: 'Erro ao resetar agente' };
    }
}

// Inicializar agentes padrão no banco
export async function initializeAIAgents(): Promise<void> {
    try {
        for (const agent of DEFAULT_AGENTS) {
            const exists = await prisma.aIAgent.findUnique({
                where: { code: agent.code }
            });

            if (!exists) {
                await prisma.aIAgent.create({
                    data: agent
                });
            }
        }
        console.log('Agentes de IA inicializados');
    } catch (error) {
        console.error('Erro ao inicializar agentes:', error);
    }
}
