'use client';

import { useState } from 'react';
import { Restaurant, AnalysisResult } from '@/lib/types';
import { generateEmailWithAI, generateStrategyWithAI, generateFollowUpMessageWithAI } from '@/app/actions';
import styles from './AIGenerator.module.css';

interface AIGeneratorProps {
    restaurant: Restaurant;
    analysis?: AnalysisResult | null;
    type: 'email' | 'strategy' | 'followup';
    onGenerated?: (content: string) => void;
}

export default function AIGenerator({ restaurant, analysis, type, onGenerated }: AIGeneratorProps) {
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<string>('');
    const [customInstructions, setCustomInstructions] = useState('');

    const handleGenerate = async () => {
        setGenerating(true);
        setResult('');
        
        try {
            let content = '';
            
            if (type === 'email') {
                const email = await generateEmailWithAI(restaurant.id, customInstructions);
                content = `Assunto: ${email.subject}\n\n${email.body}`;
            } else if (type === 'strategy') {
                const strategy = await generateStrategyWithAI(restaurant.id);
                content = strategy.strategy;
            } else if (type === 'followup') {
                const followup = await generateFollowUpMessageWithAI(restaurant.id);
                content = followup.message;
            }
            
            setResult(content);
            onGenerated?.(content);
        } catch (error) {
            console.error('Error generating with AI:', error);
            setResult('Erro ao gerar conteúdo. Verifique a chave da API da OpenAI.');
        } finally {
            setGenerating(false);
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'email': return '📧 Gerar Email com IA';
            case 'strategy': return '🎯 Gerar Estratégia com IA';
            case 'followup': return '💬 Gerar Mensagem de Follow-up com IA';
            default: return '🤖 Gerar com IA';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>{getTitle()}</h3>
                {analysis && (
                    <span className={styles.scoreBadge}>Score: {analysis.score}/100</span>
                )}
            </div>

            {type !== 'followup' && (
                <div className={styles.inputGroup}>
                    <label>Instruções Personalizadas (opcional)</label>
                    <input
                        type="text"
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Ex: Focar em embalagens para pizza, mencionar desconto de 10%..."
                        className={styles.input}
                    />
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={generating}
                className={styles.generateButton}
            >
                {generating ? (
                    <>
                        <span className={styles.spinner}></span>
                        Gerando com IA...
                    </>
                ) : (
                    <>
                        🤖 Gerar Agora
                    </>
                )}
            </button>

            {result && (
                <div className={styles.result}>
                    <div className={styles.resultHeader}>
                        <span>Resultado Gerado:</span>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(result);
                                alert('Copiado para a área de transferência!');
                            }}
                            className={styles.copyButton}
                        >
                            📋 Copiar
                        </button>
                    </div>
                    <pre className={styles.resultContent}>{result}</pre>
                </div>
            )}
        </div>
    );
}

