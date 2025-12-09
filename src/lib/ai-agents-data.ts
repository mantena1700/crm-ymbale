// Dados dos agentes de IA (constantes - não são server actions)

export interface AIAgentData {
    id?: string;
    code: string;
    name: string;
    description?: string;
    systemPrompt: string;
    userPromptTemplate: string;
    model: string;
    temperature: number;
    maxTokens: number;
    active: boolean;
    isDefault: boolean;
}

// Prompts padrão dos agentes
export const DEFAULT_AGENTS: Omit<AIAgentData, 'id'>[] = [
    {
        code: 'restaurant_analyzer',
        name: 'Analisador de Restaurantes',
        description: 'Analisa comentários de restaurantes para identificar problemas com embalagens',
        systemPrompt: `Você é um analista de vendas B2B especializado em embalagens para delivery.

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
- Score baixo (0-30) = poucos problemas = menor oportunidade`,
        userPromptTemplate: `RESTAURANTE: {{name}}
AVALIAÇÃO: {{rating}} estrelas
TOTAL AVALIAÇÕES: {{reviewCount}}

COMENTÁRIOS REAIS DOS CLIENTES:
{{comments}}

Retorne JSON com: score, summary, painPoints[], evidences[], salesCopy, strategy, status`,
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 1500,
        active: true,
        isDefault: true
    },
    {
        code: 'email_generator',
        name: 'Gerador de Emails',
        description: 'Gera emails de vendas personalizados baseados na análise',
        systemPrompt: `Você é um copywriter especializado em emails de vendas B2B. 
Crie emails personalizados que mencionem problemas específicos do cliente.
Seja breve, empático e focado em solução.`,
        userPromptTemplate: `Crie um email de vendas para o restaurante "{{name}}".

PROBLEMAS IDENTIFICADOS:
{{painPoints}}

NOSSA SOLUÇÃO:
- Embalagens à prova de vazamento
- Mantêm temperatura por mais tempo
- Apresentação premium

Crie um email curto (máximo 150 palavras) que:
1. Mencione problemas ESPECÍFICOS deste restaurante
2. Mostre empatia
3. Apresente nossa solução
4. Tenha call-to-action claro

Responda JSON: {"subject": "...", "body": "..."}`,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 500,
        active: true,
        isDefault: true
    },
    {
        code: 'strategy_generator',
        name: 'Gerador de Estratégias',
        description: 'Cria estratégias de vendas personalizadas',
        systemPrompt: `Você é um estrategista de vendas B2B. 
Crie estratégias específicas e acionáveis baseadas em dados reais do cliente.`,
        userPromptTemplate: `Crie uma estratégia de vendas ESPECÍFICA para {{name}}.

DADOS DO RESTAURANTE:
- Avaliação: {{rating}} estrelas
- Volume estimado: {{projectedDeliveries}} entregas/mês
- Potencial: {{salesPotential}}

PROBLEMAS IDENTIFICADOS:
{{painPoints}}

Crie uma estratégia em 3-4 pontos específicos e acionáveis (máximo 100 palavras).`,
        model: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 300,
        active: true,
        isDefault: true
    },
    {
        code: 'followup_generator',
        name: 'Gerador de Follow-up',
        description: 'Gera mensagens de follow-up personalizadas',
        systemPrompt: `Gere mensagens de follow-up profissionais e personalizadas.
Seja breve, cordial e focado em manter o relacionamento.`,
        userPromptTemplate: `Follow-up para {{name}}.
{{previousContact}}

Crie uma mensagem curta (máximo 80 palavras) e personalizada.`,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 200,
        active: true,
        isDefault: true
    },
    {
        code: 'report_insights',
        name: 'Gerador de Insights',
        description: 'Gera insights e análises de relatórios',
        systemPrompt: `Você é um analista de negócios especializado em vendas B2B. 
Gere insights acionáveis baseados em métricas de CRM. Use markdown para formatar.`,
        userPromptTemplate: `Analise estas métricas do CRM e gere um relatório executivo:

{{metrics}}

Gere um relatório com:
1. Resumo da situação atual
2. 3-4 insights principais
3. Recomendações prioritárias
4. Próximos passos sugeridos

Máximo 400 palavras. Use markdown.`,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 800,
        active: true,
        isDefault: true
    }
];
