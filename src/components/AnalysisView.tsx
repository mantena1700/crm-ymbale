'use client';

import { useState, useEffect } from 'react';
import { Restaurant, AnalysisResult } from '@/lib/types';
import { performAnalysis } from '@/app/actions';
import ReportButton from './ReportButton';
import StrategyView from './StrategyView';
import AIGenerator from './AIGenerator';
import styles from './AnalysisView.module.css';

interface AnalysisViewProps {
    restaurant: Restaurant;
    initialAnalysis: AnalysisResult | null;
}

export default function AnalysisView({ restaurant, initialAnalysis }: AnalysisViewProps) {
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(initialAnalysis);
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const result = await performAnalysis(restaurant.id);
            setAnalysis(result || null);
        } catch (error) {
            console.error("Error analyzing:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Analisando comentários com IA...</p>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <h3>Nenhuma análise encontrada</h3>
                    <p>Utilize a IA para analisar os comentários e gerar insights.</p>
                    <button className={styles.copyButton} onClick={handleAnalyze}>
                        ✨ Iniciar Análise IA
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                <div className={styles.mainCard}>
                    <div className={styles.scoreSection}>
                        <div className={styles.scoreCircle} style={{
                            borderColor: analysis.score > 70 ? 'var(--success)' : analysis.score > 40 ? 'var(--warning)' : 'var(--danger)'
                        }}>
                            <span className={styles.scoreValue}>{analysis.score}</span>
                            <span className={styles.scoreLabel}>Score</span>
                        </div>
                        <div className={styles.summary}>
                            <div className={styles.summaryHeader}>
                                <h3>Resumo da Análise</h3>
                                <div className={styles.headerActions}>
                                    <button
                                        className={styles.reanalyzeButton}
                                        onClick={handleAnalyze}
                                        disabled={loading}
                                    >
                                        🔄 Reanalisar
                                    </button>
                                    <ReportButton />
                                </div>
                            </div>
                            <p>{analysis.summary}</p>
                        </div>
                    </div>

                    <div className={styles.painPoints}>
                        <h3>Principais Dores Identificadas</h3>
                        <div className={styles.tags}>
                            {analysis.painPoints.map(point => (
                                <span key={point} className={styles.tag}>{point}</span>
                            ))}
                        </div>
                    </div>

                    <div className={styles.copySection}>
                        <h3>Sugestão de Abordagem (Copy)</h3>
                        <div className={styles.copyBox}>
                            <p>{analysis.salesCopy}</p>
                            <button className={styles.copyButton} onClick={() => navigator.clipboard.writeText(analysis.salesCopy)}>
                                Copiar Texto
                            </button>
                        </div>
                    </div>

                    <StrategyView strategy={analysis.strategy} />

                    <AIGenerator
                        restaurant={restaurant}
                        analysis={analysis}
                        type="strategy"
                        onGenerated={(content) => {
                            // Could update strategy here
                            console.log('Strategy generated:', content);
                        }}
                    />
                </div>

                <div className={styles.commentsCard}>
                    <h3>Comentários Relevantes</h3>
                    <div className={styles.commentsList}>
                        {restaurant.comments.slice(0, 10).map((comment, idx) => (
                            <div key={idx} className={styles.comment}>
                                <p>"{comment}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
