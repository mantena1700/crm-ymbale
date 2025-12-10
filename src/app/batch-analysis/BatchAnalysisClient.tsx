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
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedCount, setSelectedCount] = useState(5);
    const [logs, setLogs] = useState<string[]>([]);
    const [selectedRestaurants, setSelectedRestaurants] = useState<Restaurant[]>([]);

    // Animações engraçadas de carregamento
    const loadingMessages = [
        '🤖 IA analisando comentários...',
        '🧠 Processando insights...',
        '✨ Gerando recomendações...',
        '📊 Calculando scores...',
        '🎯 Identificando oportunidades...',
        '💡 Descobrindo padrões...',
        '🚀 Quase lá...',
        '🎉 Finalizando análise...'
    ];

    const [currentMessage, setCurrentMessage] = useState(loadingMessages[0]);

    const handleStart = async () => {
        if (selectedRestaurants.length === 0) {
            alert('Selecione pelo menos um restaurante para analisar');
            return;
        }

        setProcessing(true);
        setProgress(0);
        setCurrentIndex(0);
        setLogs([`🚀 Iniciando análise de ${selectedRestaurants.length} restaurante(s)...`]);

        // Animar mensagens de carregamento
        let messageIndex = 0;
        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setCurrentMessage(loadingMessages[messageIndex]);
        }, 800);

        // Simular progresso realista
        const progressInterval = setInterval(() => {
            setProgress(old => {
                if (old >= 95) return old;
                const increment = 100 / selectedRestaurants.length / 2;
                return Math.min(old + increment, 95);
            });
            setCurrentIndex(old => Math.min(old + 1, selectedRestaurants.length));
        }, 1000);

        try {
            await analyzeBatch(selectedRestaurants);
            clearInterval(progressInterval);
            clearInterval(messageInterval);
            setProgress(100);
            setCurrentIndex(selectedRestaurants.length);
            setCurrentMessage('✅ Análise concluída com sucesso!');
            setLogs(prev => [...prev, `✅ ${selectedRestaurants.length} restaurante(s) analisado(s) com sucesso!`]);
            
            // Recarregar página após 2 segundos
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            clearInterval(progressInterval);
            clearInterval(messageInterval);
            setLogs(prev => [...prev, '❌ Erro durante a análise. Verifique os logs do servidor.']);
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleSelectCount = (count: number) => {
        const maxCount = Math.min(count, toAnalyze.length);
        setSelectedCount(maxCount);
        setSelectedRestaurants(toAnalyze.slice(0, maxCount));
    };

    // Inicializar seleção
    if (selectedRestaurants.length === 0 && toAnalyze.length > 0) {
        const initialCount = Math.min(5, toAnalyze.length);
        setSelectedCount(initialCount);
        setSelectedRestaurants(toAnalyze.slice(0, initialCount));
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>🤖 Análise em Lote (IA)</h1>
                <p>Processe múltiplos clientes de uma vez com inteligência artificial</p>
            </header>

            <div className={styles.content}>
                <div className={styles.statusBox}>
                    <h3>📋 {toAnalyze.length} Restaurante(s) Disponível(is)</h3>
                    {toAnalyze.length > 0 ? (
                        <p>Selecione quantos deseja analisar de uma vez</p>
                    ) : (
                        <p>Nenhum restaurante pendente de análise. Importe mais dados em Configurações.</p>
                    )}
                </div>

                {toAnalyze.length > 0 && !processing && (
                    <div className={styles.selectionBox}>
                        <label>Quantos restaurantes deseja analisar?</label>
                        <div className={styles.countSelector}>
                            <button
                                className={`${styles.countBtn} ${selectedCount === 5 ? styles.active : ''}`}
                                onClick={() => handleSelectCount(5)}
                                disabled={toAnalyze.length < 5}
                            >
                                5
                            </button>
                            <button
                                className={`${styles.countBtn} ${selectedCount === 10 ? styles.active : ''}`}
                                onClick={() => handleSelectCount(10)}
                                disabled={toAnalyze.length < 10}
                            >
                                10
                            </button>
                            <button
                                className={`${styles.countBtn} ${selectedCount === 20 ? styles.active : ''}`}
                                onClick={() => handleSelectCount(20)}
                                disabled={toAnalyze.length < 20}
                            >
                                20
                            </button>
                            <button
                                className={`${styles.countBtn} ${selectedCount === toAnalyze.length ? styles.active : ''}`}
                                onClick={() => handleSelectCount(toAnalyze.length)}
                            >
                                Todos ({toAnalyze.length})
                            </button>
                        </div>
                        <div className={styles.customCount}>
                            <label>Ou escolha um número personalizado:</label>
                            <input
                                type="number"
                                min="1"
                                max={toAnalyze.length}
                                value={selectedCount}
                                onChange={(e) => {
                                    const count = parseInt(e.target.value) || 1;
                                    handleSelectCount(Math.min(count, toAnalyze.length));
                                }}
                                className={styles.numberInput}
                            />
                        </div>
                        <p className={styles.selectedInfo}>
                            ✅ {selectedRestaurants.length} restaurante(s) selecionado(s) para análise
                        </p>
                    </div>
                )}

                {processing && (
                    <div className={styles.progressContainer}>
                        <div className={styles.loadingAnimation}>
                            <div className={styles.spinner}></div>
                            <div className={styles.loadingText}>
                                <h3>{currentMessage}</h3>
                                <p>Analisando restaurante {currentIndex} de {selectedRestaurants.length}</p>
                            </div>
                        </div>
                        <div className={styles.progressBar}>
                            <div 
                                className={styles.progressFill} 
                                style={{ width: `${progress}%` }}
                            >
                                <span className={styles.progressText}>{Math.round(progress)}%</span>
                            </div>
                        </div>
                        <div className={styles.progressInfo}>
                            <span>{currentIndex} / {selectedRestaurants.length} concluído(s)</span>
                        </div>
                    </div>
                )}

                <div className={styles.logs}>
                    {logs.map((log, i) => (
                        <p key={i} className={styles.logItem}>
                            {log}
                        </p>
                    ))}
                </div>

                <button
                    className={styles.button}
                    onClick={handleStart}
                    disabled={processing || selectedRestaurants.length === 0}
                >
                    {processing ? (
                        <>
                            <span className={styles.spinnerSmall}></span>
                            Analisando...
                        </>
                    ) : (
                        `🚀 Iniciar Análise (${selectedRestaurants.length} restaurante${selectedRestaurants.length > 1 ? 's' : ''})`
                    )}
                </button>
            </div>
        </div>
    );
}
