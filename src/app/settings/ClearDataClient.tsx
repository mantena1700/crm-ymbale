'use client';

import { useState } from 'react';
import { clearMockData, clearLastImport } from '@/app/actions';
import styles from './ClearData.module.css';

export default function ClearDataClient() {
    const [loading, setLoading] = useState(false);
    const [loadingLastImport, setLoadingLastImport] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [resultLastImport, setResultLastImport] = useState<string | null>(null);
    const [hours, setHours] = useState(24);

    const handleClear = async () => {
        if (!confirm('⚠️ ATENÇÃO: Isso irá remover todos os dados mockados/fake do banco de dados.\n\nTem certeza que deseja continuar?')) {
            return;
        }

        if (!confirm('⚠️ CONFIRMAÇÃO FINAL: Esta ação não pode ser desfeita!\n\nDeseja realmente limpar os dados mockados?')) {
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const message = await clearMockData();
            setResult(message);
        } catch (error: any) {
            setResult(`Erro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleClearLastImport = async () => {
        if (!confirm(`⚠️ ATENÇÃO: Isso irá remover todos os restaurantes importados nas últimas ${hours} horas.\n\nTem certeza que deseja continuar?`)) {
            return;
        }

        if (!confirm('⚠️ CONFIRMAÇÃO FINAL: Esta ação não pode ser desfeita!\n\nDeseja realmente limpar a última importação?')) {
            return;
        }

        setLoadingLastImport(true);
        setResultLastImport(null);

        try {
            const response = await clearLastImport(hours);
            setResultLastImport(response.message);
        } catch (error: any) {
            setResultLastImport(`Erro: ${error.message}`);
        } finally {
            setLoadingLastImport(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h2>🗑️ Limpar Última Importação</h2>
                <p className={styles.description}>
                    Remove restaurantes importados recentemente. Útil para limpar importações que foram feitas incorretamente.
                </p>

                <div className={styles.warning}>
                    <strong>⚠️ ATENÇÃO:</strong>
                    <ul>
                        <li>Esta ação remove restaurantes importados nas últimas X horas</li>
                        <li>Todos os dados relacionados (comentários, análises, notas, etc.) serão removidos</li>
                        <li>A ação não pode ser desfeita</li>
                        <li>Use com cuidado!</li>
                    </ul>
                </div>

                <div className={styles.hoursSelector}>
                    <label htmlFor="hours">Remover importações das últimas:</label>
                    <select 
                        id="hours"
                        value={hours} 
                        onChange={(e) => setHours(Number(e.target.value))}
                        className={styles.hoursSelect}
                    >
                        <option value="1">1 hora</option>
                        <option value="6">6 horas</option>
                        <option value="12">12 horas</option>
                        <option value="24">24 horas</option>
                        <option value="48">48 horas</option>
                        <option value="72">72 horas (3 dias)</option>
                    </select>
                </div>

                <button
                    onClick={handleClearLastImport}
                    disabled={loadingLastImport}
                    className={styles.clearButton}
                >
                    {loadingLastImport ? '⏳ Limpando...' : `🗑️ Limpar Última Importação (${hours}h)`}
                </button>

                {resultLastImport && (
                    <div className={styles.result}>
                        <pre>{resultLastImport}</pre>
                    </div>
                )}
            </div>

            <div className={styles.card}>
                <h2>🧹 Limpar Dados Mockados</h2>
                <p className={styles.description}>
                    Remove todos os dados de teste/mock do banco de dados para começar a importação real.
                    Isso inclui restaurantes com nomes genéricos, dados de exemplo, etc.
                </p>

                <div className={styles.warning}>
                    <strong>⚠️ ATENÇÃO:</strong>
                    <ul>
                        <li>Esta ação remove dados mockados/fake do banco</li>
                        <li>Dados reais importados NÃO serão removidos</li>
                        <li>A ação não pode ser desfeita</li>
                        <li>Recomendado fazer antes da primeira importação real</li>
                    </ul>
                </div>

                <button
                    onClick={handleClear}
                    disabled={loading}
                    className={styles.clearButton}
                >
                    {loading ? '⏳ Limpando...' : '🧹 Limpar Dados Mockados'}
                </button>

                {result && (
                    <div className={styles.result}>
                        <pre>{result}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}

