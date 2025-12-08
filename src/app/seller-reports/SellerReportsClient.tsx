'use client';

import { useState, useEffect } from 'react';
import { Seller } from '@/lib/types';
import { generateSellerReport } from './actions';
import styles from './page.module.css';

interface Props {
    sellers: Seller[];
}

export default function SellerReportsClient({ sellers }: Props) {
    const [selectedSeller, setSelectedSeller] = useState<string>('');
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    const handleGenerateReport = async () => {
        if (!selectedSeller) {
            alert('Selecione um vendedor');
            return;
        }

        setGenerating(true);
        setReport(null); // Limpar relatório anterior
        try {
            console.log('🔄 Iniciando geração de relatório para vendedor:', selectedSeller);
            const data = await generateSellerReport(selectedSeller);
            console.log('✅ Relatório gerado com sucesso:', data);
            setReport(data);
        } catch (error: any) {
            console.error('❌ Erro ao gerar relatório:', error);
            const errorMessage = error?.message || 'Erro desconhecido ao gerar relatório';
            alert('Erro ao gerar relatório:\n\n' + errorMessage + '\n\nVerifique se a chave da API OpenAI está configurada corretamente.');
        } finally {
            setGenerating(false);
        }
    };

    const selectedSellerData = sellers.find(s => s.id === selectedSeller);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>📊 Relatórios por Vendedor</h1>
                <p className={styles.subtitle}>Análise completa de performance e clientes por vendedor</p>
            </div>

            <div className={styles.selectorCard}>
                <label>Selecione o Vendedor:</label>
                <select
                    value={selectedSeller}
                    onChange={(e) => {
                        setSelectedSeller(e.target.value);
                        setReport(null);
                    }}
                    className={styles.sellerSelect}
                >
                    <option value="">-- Selecione um vendedor --</option>
                    {sellers.filter(s => s.active).map(seller => (
                        <option key={seller.id} value={seller.id}>
                            {seller.name}
                        </option>
                    ))}
                </select>
                <button
                    onClick={handleGenerateReport}
                    disabled={!selectedSeller || generating}
                    className={styles.generateButton}
                >
                    {generating ? '🔄 Gerando...' : '✨ Gerar Relatório com IA'}
                </button>
            </div>

            {report && selectedSellerData && (
                <div className={styles.reportContainer}>
                    <div className={styles.reportHeader}>
                        <h2>Relatório: {selectedSellerData.name}</h2>
                        <span className={styles.reportDate}>
                            Gerado em {new Date().toLocaleDateString('pt-BR')}
                        </span>
                    </div>

                    {/* Summary Cards */}
                    <div className={styles.summaryGrid}>
                        <div className={styles.summaryCard}>
                            <div className={styles.summaryIcon}>👥</div>
                            <div className={styles.summaryContent}>
                                <label>Total de Clientes</label>
                                <div className={styles.summaryValue}>{report.totalClients}</div>
                            </div>
                        </div>
                        <div className={styles.summaryCard}>
                            <div className={styles.summaryIcon}>✅</div>
                            <div className={styles.summaryContent}>
                                <label>Clientes Qualificados</label>
                                <div className={styles.summaryValue}>{report.qualifiedClients}</div>
                            </div>
                        </div>
                        <div className={styles.summaryCard}>
                            <div className={styles.summaryIcon}>📅</div>
                            <div className={styles.summaryContent}>
                                <label>Visitas Realizadas</label>
                                <div className={styles.summaryValue}>{report.totalVisits}</div>
                            </div>
                        </div>
                        <div className={styles.summaryCard}>
                            <div className={styles.summaryIcon}>💰</div>
                            <div className={styles.summaryContent}>
                                <label>Potencial Total</label>
                                <div className={styles.summaryValue}>
                                    {report.totalPotential.toLocaleString('pt-BR')} entregas/mês
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Insights */}
                    {report.aiInsights && (
                        <div className={styles.insightsCard}>
                            <h3>💡 Análise Inteligente (IA)</h3>
                            <div className={styles.insightsContent}>
                                {report.aiInsights.split('\n').map((line: string, i: number) => (
                                    <p key={i}>{line}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Top Clients */}
                    {report.topClients && report.topClients.length > 0 && (
                        <div className={styles.clientsCard}>
                            <h3>🏆 Top Clientes</h3>
                            <div className={styles.clientsList}>
                                {report.topClients.map((client: any, i: number) => (
                                    <div key={client.id} className={styles.clientItem}>
                                        <span className={styles.clientRank}>#{i + 1}</span>
                                        <div className={styles.clientInfo}>
                                            <div className={styles.clientName}>{client.name}</div>
                                            <div className={styles.clientDetails}>
                                                <span>⭐ {client.rating}</span>
                                                <span>📦 {client.projectedDeliveries} entregas/mês</span>
                                                <span className={styles.clientStatus}>{client.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {report.recommendations && report.recommendations.length > 0 && (
                        <div className={styles.recommendationsCard}>
                            <h3>🎯 Recomendações</h3>
                            <ul className={styles.recommendationsList}>
                                {report.recommendations.map((rec: string, i: number) => (
                                    <li key={i}>{rec}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

