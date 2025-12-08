'use client';

import { useState } from 'react';
import { Restaurant } from '@/lib/types';
import { analyzeBatch } from '@/app/actions';
import styles from './page.module.css';

interface Props {
    toAnalyze: Restaurant[];
}

export default function BatchAnalysisClient({ toAnalyze }: Props) {
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);

    const handleStart = async () => {
        setProcessing(true);
        setLogs(prev => [...prev, 'Iniciando análise em lote...']);

        // In a real scenario with progress updates, we'd need streaming or chunked processing.
        // For this prototype, we'll simulate progress visually while waiting for the server action.

        const interval = setInterval(() => {
            setProgress(old => {
                if (old >= 90) return old;
                return old + 5;
            });
        }, 500);

        try {
            await analyzeBatch(toAnalyze.slice(0, 5)); // Limit to 5 to avoid timeout/rate limits
            clearInterval(interval);
            setProgress(100);
            setLogs(prev => [...prev, 'Análise de 5 restaurantes concluída com sucesso!']);
        } catch (error) {
            setLogs(prev => [...prev, 'Erro durante a análise.']);
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>🤖 Análise em Lote (IA)</h1>
                <p>Processe múltiplos clientes de uma vez com a inteligência do Gemini.</p>
            </header>

            <div className={styles.content}>
                <div className={styles.statusBox}>
                    <h3>{toAnalyze.length} Restaurantes na fila</h3>
                    {toAnalyze.length > 0 ? (
                        <p>Prontos para serem analisados pela IA.</p>
                    ) : (
                        <p>Nenhum restaurante pendente de análise. Importe mais dados em Configurações.</p>
                    )}
                </div>

                {processing && (
                    <div className={styles.progressContainer}>
                        <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
                        </div>
                        <p>{progress}% concluído</p>
                    </div>
                )}

                <div className={styles.logs}>
                    {logs.map((log, i) => <p key={i}>{log}</p>)}
                </div>

                <button
                    className={styles.button}
                    onClick={handleStart}
                    disabled={processing || toAnalyze.length === 0}
                >
                    {processing ? 'Processando...' : 'Iniciar Análise (Lote de 5)'}
                </button>
            </div>
        </div>
    );
}
