import { Restaurant, AnalysisResult } from './types';
import { analyzeRestaurantWithOpenAI } from './openai-service';
import { getOpenAiApiKey } from '@/app/settings/api-keys-actions';

export async function analyzeRestaurant(restaurant: Restaurant): Promise<AnalysisResult> {
    const openaiKey = await getOpenAiApiKey();
    
    console.log('=== AI ANALYSIS START ===');
    console.log('Restaurant:', restaurant.name);
    console.log('API Key:', openaiKey ? `Present (${openaiKey.length} chars)` : 'MISSING');
    
    if (!openaiKey || openaiKey.length < 50) {
        console.error('❌ No valid API key found');
        return {
            restaurantId: restaurant.id,
            score: 0,
            summary: 'Chave da API não configurada. Configure a chave OpenAI nas Configurações do Sistema.',
            painPoints: ['Configuração necessária'],
            salesCopy: 'Configure a chave da API nas Configurações para gerar análises.',
            status: 'A Analisar'
        } as AnalysisResult;
    }

    try {
        console.log('🚀 Calling OpenAI...');
        const result = await analyzeRestaurantWithOpenAI(restaurant, openaiKey);
        console.log('✅ Analysis complete! Score:', result.score);
        console.log('=== AI ANALYSIS END ===');
        return result;
    } catch (error: any) {
        console.error('❌ Analysis failed:', error?.message || error);
        console.log('=== AI ANALYSIS END (ERROR) ===');
        return {
            restaurantId: restaurant.id,
            score: 0,
            summary: `Erro: ${error?.message || 'Falha na análise'}`,
            painPoints: ['Erro de conexão'],
            salesCopy: 'Não foi possível gerar.',
            status: 'A Analisar'
        } as AnalysisResult;
    }
}
