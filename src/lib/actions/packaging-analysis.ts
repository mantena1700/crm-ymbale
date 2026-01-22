'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Tipos para classificação
export type PackagingIssue = 'vazamento' | 'temperatura' | 'apresentacao' | 'embalagem_fraca' | 'outro';

export interface PackagingAnalysis {
    hasIssues: boolean;
    issues: PackagingIssue[];
    count: number;
    score: number; // 0-100, onde 100 é alta probabilidade de problema
    summary: string;
    classification: string;
    painPoints: string[];
}

/**
 * Analisa comentários em busca de problemas de embalagem
 */
export async function analyzePackagingComments(comments: string[], salesPotential: string): Promise<{
    totalIssues: number;
    classification: string;
    summary: string;
    painPoints: string[];
}> {
    const keywords = {
        vazamento: ['vazou', 'vazando', 'derramou', 'molhou', 'aberta', 'aberto', 'virada', 'entornou'],
        temperatura: ['fria', 'frio', 'gelada', 'gelado', 'morna', 'morno', 'chegou fria', 'chegou frio'],
        embalagem_fraca: ['amassada', 'amassado', 'rasgada', 'rasgado', 'solta', 'mole', 'quebrada', 'frágil', 'embalagem ruim', 'pessima embalagem'],
        apresentacao: ['bagunçada', 'bagunçado', 'revirada', 'misturada', 'feia', 'jogada']
    };

    const issues: Record<string, number> = {
        vazamento: 0,
        temperatura: 0,
        embalagem_fraca: 0,
        apresentacao: 0
    };

    const detectedPainPoints: string[] = [];

    // Analisar cada comentário
    let totalIssues = 0;
    
    // Normalizar comentários para string única para análise rápida ou iterar se precisar de contagem precisa
    // Aqui vamos iterar para ser mais preciso
    for (const comment of comments) {
        if (!comment) continue;
        const lowerComment = String(comment).toLowerCase();

        for (const [type, words] of Object.entries(keywords)) {
            if (words.some(w => lowerComment.includes(w))) {
                issues[type]++;
                totalIssues++;
            }
        }
    }

    // Classificar
    let classification = 'BAIXO POTENCIAL';
    let priority = 0;

    if (issues.vazamento > 0) {
        classification = 'ALTA PRIORIDADE (VAZAMENTO)';
        detectedPainPoints.push('Problemas críticos com vazamento');
        priority += 50;
    }
    if (issues.temperatura > 0) {
        classification = issues.vazamento > 0 ? classification + ' + TEMP' : 'ALTA PRIORIDADE (TEMPERATURA)';
        detectedPainPoints.push('Reclamações sobre temperatura');
        priority += 30;
    }
    if (issues.embalagem_fraca > 0) {
        detectedPainPoints.push('Embalagem frágil ou danificada');
        priority += 20;
    }

    // Ajustar por volume de reclamações
    if (totalIssues >= 3) {
        classification = 'DIAMANTE - CRÍTICO';
        priority += 50;
    } else if (totalIssues === 0) {
        classification = 'SEM PROBLEMAS DETECTADOS';
    }

    const summary = detectedPainPoints.length > 0 
        ? `Detectados ${totalIssues} problemas: ${detectedPainPoints.join(', ')}`
        : 'Nenhum problema grave de embalagem detectado nos comentários recentes.';

    return {
        totalIssues,
        classification,
        summary,
        painPoints: detectedPainPoints
    };
}

/**
 * Calcula prioridade baseada em classificação e potencial de vendas
 */
export async function calculateLeadPriority(classification: string, salesPotential: string): Promise<string> {
    const isHighPotential = String(salesPotential).toUpperCase().includes('ALTISSIMO') || String(salesPotential).toUpperCase().includes('ALTÍSSIMO') || String(salesPotential).toUpperCase() === 'ALTO';
    const isCriticalIssue = classification.includes('DIAMANTE') || classification.includes('ALTA') || classification.includes('VAZAMENTO');

    if (isCriticalIssue && isHighPotential) {
        return 'DIAMANTE 💎 (Ligar Agora)';
    }
    if (isCriticalIssue) {
        return 'OURO 🏆 (Prioridade Alta)';
    }
    if (isHighPotential) {
        return 'PRATA 🥈 (Monitorar)';
    }
    
    return 'BRONZE 🥉 (Baixa Prioridade)';
}

/**
 * Reprocessa toda a base de restaurantes
 */
export async function reprocessAllRestaurants() {
    try {
        const restaurants = await prisma.restaurant.findMany({
            include: {
                comments: true,
                analyses: true // Incluir análises existentes para não duplicar desnecessariamente se já tiver
            }
        });

        let updatedCount = 0;

        for (const restaurant of restaurants) {
            // Extrair comentários em array de strings
            const commentTexts = restaurant.comments.map(c => c.content);
            
            // Analisar
            const analysis = await analyzePackagingComments(commentTexts, restaurant.salesPotential || 'N/A');
            
            if (analysis.totalIssues > 0) {
                // Calcular prioridade
                const priority = await calculateLeadPriority(analysis.classification, restaurant.salesPotential || 'N/A');
                
                // Atualizar/Criar análise
                // Verifica se já tem análise recente
                const existingAnalysis = restaurant.analyses[0]; // Simplificação: pega a primeira

                if (!existingAnalysis) {
                    await prisma.analysis.create({
                        data: {
                            restaurantId: restaurant.id,
                            score: Math.min(analysis.totalIssues * 20, 100),
                            summary: `[AUTO-REPROCESS] ${analysis.summary}`,
                            painPoints: analysis.painPoints,
                            salesCopy: `Focar em: ${analysis.summary}`,
                            strategy: priority,
                            status: 'Analisado'
                        }
                    });
                    
                    // Se for crítico, pode atualizar status do lead também
                    if (priority.includes('DIAMANTE') && restaurant.status !== 'Qualificado' && restaurant.status !== 'Fechado' && restaurant.status !== 'Negociação') {
                        await prisma.restaurant.update({
                            where: { id: restaurant.id },
                            data: { status: 'Qualificado' }
                        });
                    }

                    updatedCount++;
                }
            }
        }

        revalidatePath('/packaging-analysis');
        revalidatePath('/clients');
        
        return { success: true, count: updatedCount, total: restaurants.length };
        
    } catch (error) {
        console.error('Erro ao reprocessar:', error);
        throw new Error('Falha ao reprocessar base de dados');
    }
}
