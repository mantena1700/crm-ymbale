'use server';

import { prisma } from '@/lib/db';

// Máscara para esconder a maior parte da key
function maskApiKey(key: string | null): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

export async function getApiKeysConfig(): Promise<{
    openaiApiKey: string;
    googleMapsApiKey: string;
    googleAiApiKey: string;
    hasOpenai: boolean;
    hasGoogleMaps: boolean;
    hasGoogleAi: boolean;
}> {
    try {
        const settings = await prisma.systemSettings.findFirst({
            where: { id: 'system' }
        });

        return {
            openaiApiKey: maskApiKey(settings?.openaiApiKey || process.env.OPENAI_API_KEY || null),
            googleMapsApiKey: maskApiKey(settings?.googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null),
            googleAiApiKey: maskApiKey(settings?.googleAiApiKey || process.env.GOOGLE_AI_API_KEY || null),
            hasOpenai: !!(settings?.openaiApiKey || process.env.OPENAI_API_KEY),
            hasGoogleMaps: !!(settings?.googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
            hasGoogleAi: !!(settings?.googleAiApiKey || process.env.GOOGLE_AI_API_KEY),
        };
    } catch (error) {
        console.error('Erro ao buscar API keys:', error);
        return {
            openaiApiKey: '',
            googleMapsApiKey: '',
            googleAiApiKey: '',
            hasOpenai: !!process.env.OPENAI_API_KEY,
            hasGoogleMaps: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
            hasGoogleAi: !!process.env.GOOGLE_AI_API_KEY,
        };
    }
}

export async function saveApiKey(
    keyType: 'openai' | 'googleMaps' | 'googleAi',
    value: string
): Promise<{ success: boolean; message: string }> {
    try {
        if (!value || value.length < 10) {
            return { success: false, message: 'Chave de API inválida' };
        }

        const updateData: Record<string, string> = {};
        
        switch (keyType) {
            case 'openai':
                if (!value.startsWith('sk-')) {
                    return { success: false, message: 'Chave OpenAI deve começar com sk-' };
                }
                updateData.openaiApiKey = value;
                break;
            case 'googleMaps':
                updateData.googleMapsApiKey = value;
                break;
            case 'googleAi':
                updateData.googleAiApiKey = value;
                break;
        }

        await prisma.systemSettings.upsert({
            where: { id: 'system' },
            update: updateData,
            create: {
                id: 'system',
                ...updateData
            }
        });

        return { success: true, message: 'Chave de API salva com sucesso!' };
    } catch (error) {
        console.error('Erro ao salvar API key:', error);
        return { success: false, message: 'Erro ao salvar chave de API' };
    }
}

export async function removeApiKey(
    keyType: 'openai' | 'googleMaps' | 'googleAi'
): Promise<{ success: boolean; message: string }> {
    try {
        const updateData: Record<string, null> = {};
        
        switch (keyType) {
            case 'openai':
                updateData.openaiApiKey = null;
                break;
            case 'googleMaps':
                updateData.googleMapsApiKey = null;
                break;
            case 'googleAi':
                updateData.googleAiApiKey = null;
                break;
        }

        await prisma.systemSettings.update({
            where: { id: 'system' },
            data: updateData as any
        });

        return { success: true, message: 'Chave de API removida' };
    } catch (error) {
        console.error('Erro ao remover API key:', error);
        return { success: false, message: 'Erro ao remover chave de API' };
    }
}

// Função para buscar a API key real para uso interno
export async function getOpenAiApiKey(): Promise<string | null> {
    try {
        const settings = await prisma.systemSettings.findFirst({
            where: { id: 'system' }
        });
        return settings?.openaiApiKey || process.env.OPENAI_API_KEY || null;
    } catch {
        return process.env.OPENAI_API_KEY || null;
    }
}

export async function getGoogleMapsApiKey(): Promise<string | null> {
    try {
        const settings = await prisma.systemSettings.findFirst({
            where: { id: 'system' }
        });
        return settings?.googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
    } catch {
        return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
    }
}

