import OpenAI from 'openai';
import { Restaurant, AnalysisResult } from './types';
import 'server-only';

/**
 * Analyze restaurant using OpenAI GPT - REAL analysis based on actual comments
 */
export async function analyzeRestaurantWithOpenAI(restaurant: Restaurant): Promise<AnalysisResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('========================================');
    console.log('🔍 STARTING REAL AI ANALYSIS');
    console.log('Restaurant:', restaurant.name);
    console.log('Total comments available:', restaurant.comments.length);
    
    if (!apiKey || apiKey.length < 50) {
        console.error('❌ API Key invalid or missing');
        throw new Error('OPENAI_API_KEY não configurada');
    }

    const openai = new OpenAI({ apiKey });
    
    // Get ALL comments (up to 25 for better analysis)
    const allComments = restaurant.comments.slice(0, 25);
    
    if (allComments.length === 0) {
        console.log('⚠️ No comments found for analysis');
        return {
            restaurantId: restaurant.id,
            score: 0,
            summary: 'Sem comentários para análise.',
            painPoints: [],
            salesCopy: 'N/A',
            status: 'A Analisar'
        } as AnalysisResult;
    }

    // Format comments with numbers for reference
    const formattedComments = allComments.map((c, i) => `[${i + 1}] "${c}"`).join('\n\n');
    
    console.log('📝 Comments being analyzed:');
    console.log('---');
    allComments.slice(0, 5).forEach((c, i) => console.log(`[${i + 1}] ${c.substring(0, 80)}...`));
    console.log('... and', allComments.length - 5, 'more comments');
    console.log('---');

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Você é um analista de vendas B2B especializado em embalagens para delivery.

CONTEXTO DA EMPRESA:
- Vendemos embalagens premium para restaurantes de delivery
- Nossas embalagens são: à prova de vazamento, mantêm temperatura, apresentação premium
- Nosso objetivo é identificar restaurantes com problemas de embalagem para oferecer nossa solução

SUA TAREFA:
Analisar CADA comentário fornecido e identificar PROBLEMAS ESPECÍFICOS relacionados a:
1. VAZAMENTO - molho vazando, embalagem molhada, comida derramada
2. TEMPERATURA - comida fria, morna, perdeu calor
3. EMBALAGEM - amassada, aberta, frágil, mal fechada
4. APRESENTAÇÃO - bagunçada, misturada, mal apresentada

IMPORTANTE:
- Cite TRECHOS EXATOS dos comentários como evidência
- Seja específico - mencione quais comentários indicam cada problema
- Score alto (70-100) = muitos problemas de embalagem identificados = oportunidade de venda
- Score baixo (0-30) = poucos problemas = menor oportunidade

Responda APENAS com JSON válido.`
                },
                {
                    role: 'user',
                    content: `RESTAURANTE: ${restaurant.name}
AVALIAÇÃO: ${restaurant.rating} estrelas
TOTAL AVALIAÇÕES: ${restaurant.reviewCount}

COMENTÁRIOS REAIS DOS CLIENTES (analise CADA um):

${formattedComments}

Baseado EXCLUSIVAMENTE nos comentários acima, retorne JSON:
{
  "score": <0-100 baseado em quantos problemas de EMBALAGEM você encontrou>,
  "summary": "<resumo de 2-3 frases citando problemas ESPECÍFICOS encontrados nos comentários acima>",
  "painPoints": ["<problema específico 1 com citação>", "<problema específico 2 com citação>", "<problema específico 3 com citação>"],
  "evidences": ["<trecho exato do comentário 1>", "<trecho exato do comentário 2>"],
  "salesCopy": "<abordagem comercial PERSONALIZADA mencionando os problemas específicos deste restaurante>",
  "strategy": "<estratégia específica baseada nos problemas identificados>",
  "status": "Qualificado" (se score >= 60) ou "A Analisar" (se score < 40) ou "Negociação" (se entre 40-60)
}`
                }
            ],
            temperature: 0.3, // Lower temperature for more consistent, factual responses
            response_format: { type: 'json_object' }
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        console.log('✅ OpenAI Response:');
        console.log(responseText);
        
        const data = JSON.parse(responseText);
        
        console.log('🎯 Analysis Results:');
        console.log('- Score:', data.score);
        console.log('- Pain Points:', data.painPoints);
        console.log('- Evidences:', data.evidences);
        console.log('========================================');

        return {
            restaurantId: restaurant.id,
            score: data.score || 0,
            summary: data.summary || 'Análise inconclusiva.',
            painPoints: data.painPoints || [],
            salesCopy: data.salesCopy || 'Entre em contato para conhecer nossas embalagens.',
            strategy: data.strategy || 'Contato inicial',
            status: data.status || 'A Analisar',
        } as AnalysisResult;

    } catch (error: any) {
        console.error('❌ OpenAI Error:', error?.message || error);
        console.error('Error details:', error?.status, error?.code);
        console.log('========================================');
        
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

/**
 * Generate email with AI - based on real analysis
 */
export async function generateEmailWithAI(
    restaurant: Restaurant,
    analysis: AnalysisResult | null,
    customInstructions?: string
): Promise<{ subject: string; body: string }> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey.length < 50) {
        return {
            subject: `Proposta de Embalagens - ${restaurant.name}`,
            body: `Olá,\n\nGostaríamos de apresentar nossas embalagens premium para ${restaurant.name}.\n\nAtenciosamente`
        };
    }

    // Get some real comments for context
    const sampleComments = restaurant.comments.slice(0, 5).join('\n');

    try {
        const openai = new OpenAI({ apiKey });
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Você é um copywriter especializado em emails de vendas B2B. Crie emails personalizados que mencionem problemas específicos do cliente.'
                },
                {
                    role: 'user',
                    content: `Crie um email de vendas para o restaurante "${restaurant.name}".

PROBLEMAS IDENTIFICADOS:
${analysis ? analysis.painPoints.map(p => `- ${p}`).join('\n') : 'Nenhum problema específico identificado ainda.'}

ALGUNS COMENTÁRIOS DOS CLIENTES:
${sampleComments}

${customInstructions ? `INSTRUÇÕES ESPECIAIS: ${customInstructions}` : ''}

NOSSA SOLUÇÃO:
- Embalagens à prova de vazamento
- Mantêm temperatura por mais tempo
- Apresentação premium

Crie um email curto (máximo 150 palavras) que:
1. Mencione problemas ESPECÍFICOS deste restaurante
2. Mostre empatia
3. Apresente nossa solução
4. Tenha call-to-action claro

Responda JSON: {"subject": "...", "body": "..."}`
                }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const data = JSON.parse(completion.choices[0]?.message?.content || '{}');
        return {
            subject: data.subject || `Proposta - ${restaurant.name}`,
            body: data.body || 'Olá, gostaríamos de apresentar nossas embalagens.'
        };
    } catch (error) {
        console.error('Email generation error:', error);
        return {
            subject: `Proposta de Embalagens - ${restaurant.name}`,
            body: `Olá,\n\nGostaríamos de apresentar nossas embalagens premium.\n\nAtenciosamente`
        };
    }
}

/**
 * Generate strategy with AI - based on real data
 */
export async function generateStrategyWithAI(
    restaurant: Restaurant,
    analysis: AnalysisResult | null
): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey.length < 50) {
        return 'Estratégia padrão: Contato inicial por email, seguido de ligação.';
    }

    const sampleComments = restaurant.comments.slice(0, 3).join('\n');

    try {
        const openai = new OpenAI({ apiKey });
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Você é um estrategista de vendas B2B. Crie estratégias específicas e acionáveis baseadas em dados reais do cliente.'
                },
                {
                    role: 'user',
                    content: `Crie uma estratégia de vendas ESPECÍFICA para ${restaurant.name}.

DADOS DO RESTAURANTE:
- Avaliação: ${restaurant.rating} estrelas
- Volume estimado: ${restaurant.projectedDeliveries} entregas/mês
- Potencial: ${restaurant.salesPotential}

PROBLEMAS IDENTIFICADOS:
${analysis ? analysis.painPoints.map(p => `- ${p}`).join('\n') : 'Nenhum identificado ainda.'}

COMENTÁRIOS RELEVANTES:
${sampleComments}

Crie uma estratégia em 3-4 pontos específicos e acionáveis (máximo 100 palavras).
Mencione ações concretas baseadas nos problemas deste restaurante específico.`
                }
            ],
            temperature: 0.6,
            max_tokens: 250
        });

        return completion.choices[0]?.message?.content || 'Contato inicial recomendado.';
    } catch (error) {
        console.error('Strategy generation error:', error);
        return 'Estratégia padrão: Contato inicial por email.';
    }
}

/**
 * Generate follow-up message
 */
export async function generateFollowUpMessageWithAI(
    restaurant: Restaurant,
    previousContact?: string
): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey.length < 50) {
        return `Olá, gostaria de dar seguimento à nossa conversa sobre embalagens para ${restaurant.name}.`;
    }

    try {
        const openai = new OpenAI({ apiKey });
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Gere mensagens de follow-up profissionais e personalizadas.'
                },
                {
                    role: 'user',
                    content: `Follow-up para ${restaurant.name}.
${previousContact ? `Contato anterior: ${previousContact}` : 'Primeiro contato.'}

Crie uma mensagem curta (máximo 80 palavras) e personalizada.`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return completion.choices[0]?.message?.content || 'Gostaria de dar seguimento à nossa conversa.';
    } catch (error) {
        console.error('Follow-up generation error:', error);
        return `Olá, gostaria de retomar nossa conversa sobre embalagens.`;
    }
}

/**
 * Segment client with AI
 */
export async function segmentClientWithAI(
    restaurant: Restaurant, 
    analysis: AnalysisResult | null
): Promise<{ segment: 'high' | 'medium' | 'low'; reasoning: string; priority: number }> {
    const score = analysis?.score || 0;
    const potential = restaurant.salesPotential;
    
    if (score >= 70 || potential === 'ALTÍSSIMO') {
        return { segment: 'high', reasoning: 'Alto score ou potencial altíssimo', priority: 9 };
    }
    if (score >= 40 || potential === 'ALTO') {
        return { segment: 'medium', reasoning: 'Score médio ou potencial alto', priority: 6 };
    }
    return { segment: 'low', reasoning: 'Score baixo', priority: 3 };
}

/**
 * Generate report insights with AI
 */
export async function generateReportInsights(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey.length < 50) {
        throw new Error('OPENAI_API_KEY não configurada');
    }

    const cleanKey = apiKey.trim().replace(/^["'@]+|["'@]+$/g, '');
    const openai = new OpenAI({ apiKey: cleanKey });

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Você é um analista de vendas especializado em CRM. Gere análises executivas detalhadas, objetivas e acionáveis em português brasileiro.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1500
        });

        return completion.choices[0]?.message?.content || 'Não foi possível gerar análise no momento.';
    } catch (error: any) {
        console.error('Erro ao gerar insights:', error);
        throw new Error(`Erro ao gerar insights: ${error.message}`);
    }
}
