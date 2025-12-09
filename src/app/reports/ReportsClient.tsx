'use client';

import { useState, useEffect } from 'react';
import { ReportMetrics, getReportMetrics, getExportData, generateAIInsights } from './actions';
import styles from './page.module.css';
import * as XLSX from 'xlsx';

interface ReportsClientProps {
    initialMetrics: ReportMetrics;
}

export default function ReportsClient({ initialMetrics }: ReportsClientProps) {
    const [metrics, setMetrics] = useState<ReportMetrics>(initialMetrics);
    const [loading, setLoading] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingPDF, setExportingPDF] = useState(false);
    const [aiInsights, setAiInsights] = useState<string>('');
    const [generatingInsights, setGeneratingInsights] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'funnel' | 'regions' | 'categories' | 'ai'>('overview');
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all');

    const refreshMetrics = async () => {
        setLoading(true);
        try {
            const newMetrics = await getReportMetrics();
            setMetrics(newMetrics);
        } catch (error) {
            console.error('Error refreshing metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = async () => {
        setExportingExcel(true);
        try {
            const data = await getExportData();
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Sheet 1: All Restaurants
            const ws1 = XLSX.utils.json_to_sheet(data.restaurants);
            XLSX.utils.book_append_sheet(wb, ws1, 'Restaurantes');
            
            // Sheet 2: Summary
            const summaryData = [
                { 'Métrica': 'Total de Leads', 'Valor': metrics.totalRestaurants },
                { 'Métrica': 'Leads Analisados', 'Valor': metrics.analyzedCount },
                { 'Métrica': 'Leads Qualificados', 'Valor': metrics.qualifiedCount },
                { 'Métrica': 'Score Médio', 'Valor': metrics.avgScore },
                { 'Métrica': 'Alto Potencial', 'Valor': metrics.highPotentialCount },
                { 'Métrica': 'Médio Potencial', 'Valor': metrics.mediumPotentialCount },
                { 'Métrica': 'Baixo Potencial', 'Valor': metrics.lowPotentialCount },
                { 'Métrica': 'Projeção Entregas/Mês', 'Valor': metrics.totalProjectedDeliveries },
            ];
            const ws2 = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');
            
            // Sheet 3: By Status
            const ws3 = XLSX.utils.json_to_sheet(metrics.byStatus.map(s => ({
                'Status': s.status,
                'Quantidade': s.count
            })));
            XLSX.utils.book_append_sheet(wb, ws3, 'Por Status');
            
            // Sheet 4: By Region
            const ws4 = XLSX.utils.json_to_sheet(metrics.byRegion.map(r => ({
                'Região': r.region,
                'Quantidade': r.count
            })));
            XLSX.utils.book_append_sheet(wb, ws4, 'Por Região');
            
            // Sheet 5: By City
            const ws5 = XLSX.utils.json_to_sheet(metrics.byCity.map(c => ({
                'Cidade': c.city,
                'Quantidade': c.count
            })));
            XLSX.utils.book_append_sheet(wb, ws5, 'Por Cidade');
            
            // Sheet 6: Top Restaurants
            const ws6 = XLSX.utils.json_to_sheet(metrics.topRestaurants.map(r => ({
                'Nome': r.name,
                'Score': r.score,
                'Potencial': r.potential
            })));
            XLSX.utils.book_append_sheet(wb, ws6, 'Top Restaurantes');
            
            // Sheet 7: Funnel
            const ws7 = XLSX.utils.json_to_sheet(metrics.conversionFunnel.map(f => ({
                'Etapa': f.stage,
                'Quantidade': f.count,
                'Percentual': `${f.percentage}%`
            })));
            XLSX.utils.book_append_sheet(wb, ws7, 'Funil de Conversão');
            
            // Download
            const date = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `relatorio_crm_${date}.xlsx`);
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Erro ao exportar para Excel');
        } finally {
            setExportingExcel(false);
        }
    };

    const exportToPDF = async () => {
        setExportingPDF(true);
        try {
            // Generate a printable HTML report
            const reportContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Relatório CRM Ymbale</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
        h2 { color: #8b5cf6; margin-top: 30px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 15px; background: #f3f4f6; border-radius: 8px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #6366f1; }
        .metric-label { font-size: 12px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        th { background: #6366f1; color: white; }
        tr:nth-child(even) { background: #f9fafb; }
        .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
    </style>
</head>
<body>
    <h1>📊 Relatório CRM Ymbale</h1>
    <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
    
    <h2>📈 Métricas Principais</h2>
    <div>
        <div class="metric">
            <div class="metric-value">${metrics.totalRestaurants}</div>
            <div class="metric-label">Total de Leads</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.analyzedCount}</div>
            <div class="metric-label">Analisados</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.qualifiedCount}</div>
            <div class="metric-label">Qualificados</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.avgScore}/100</div>
            <div class="metric-label">Score Médio</div>
        </div>
    </div>
    
    <h2>🎯 Potencial de Vendas</h2>
    <table>
        <tr><th>Potencial</th><th>Quantidade</th><th>%</th></tr>
        <tr><td>Alto/Altíssimo</td><td>${metrics.highPotentialCount}</td><td>${Math.round((metrics.highPotentialCount / metrics.totalRestaurants) * 100)}%</td></tr>
        <tr><td>Médio</td><td>${metrics.mediumPotentialCount}</td><td>${Math.round((metrics.mediumPotentialCount / metrics.totalRestaurants) * 100)}%</td></tr>
        <tr><td>Baixo</td><td>${metrics.lowPotentialCount}</td><td>${Math.round((metrics.lowPotentialCount / metrics.totalRestaurants) * 100)}%</td></tr>
    </table>
    
    <h2>📊 Funil de Conversão</h2>
    <table>
        <tr><th>Etapa</th><th>Quantidade</th><th>Conversão</th></tr>
        ${metrics.conversionFunnel.map(f => `<tr><td>${f.stage}</td><td>${f.count}</td><td>${f.percentage}%</td></tr>`).join('')}
    </table>
    
    <h2>🏆 Top 10 Restaurantes (por Score)</h2>
    <table>
        <tr><th>Posição</th><th>Nome</th><th>Score</th><th>Potencial</th></tr>
        ${metrics.topRestaurants.map((r, i) => `<tr><td>${i + 1}º</td><td>${r.name}</td><td>${r.score}</td><td>${r.potential}</td></tr>`).join('')}
    </table>
    
    <h2>📍 Por Região</h2>
    <table>
        <tr><th>Estado</th><th>Quantidade</th></tr>
        ${metrics.byRegion.map(r => `<tr><td>${r.region}</td><td>${r.count}</td></tr>`).join('')}
    </table>
    
    <h2>🏙️ Por Cidade</h2>
    <table>
        <tr><th>Cidade</th><th>Quantidade</th></tr>
        ${metrics.byCity.map(c => `<tr><td>${c.city}</td><td>${c.count}</td></tr>`).join('')}
    </table>
    
    <div class="footer">
        <p>Relatório gerado automaticamente pelo CRM Ymbale</p>
    </div>
</body>
</html>
            `;
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(reportContent);
                printWindow.document.close();
                printWindow.print();
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Erro ao gerar PDF');
        } finally {
            setExportingPDF(false);
        }
    };

    const generateInsights = async () => {
        setGeneratingInsights(true);
        try {
            const insights = await generateAIInsights(metrics);
            setAiInsights(insights);
            setActiveTab('ai');
        } catch (error) {
            console.error('Error generating insights:', error);
            alert('Erro ao gerar insights com IA');
        } finally {
            setGeneratingInsights(false);
        }
    };

    const getProgressWidth = (percentage: number) => {
        return `${Math.min(percentage, 100)}%`;
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div>
                        <h1>📊 Relatórios & Métricas</h1>
                        <p>Análise completa do seu pipeline de vendas</p>
                    </div>
                    <div className={styles.headerActions}>
                        <button 
                            className={styles.refreshButton}
                            onClick={refreshMetrics}
                            disabled={loading}
                        >
                            {loading ? '🔄 Atualizando...' : '🔄 Atualizar Dados'}
                        </button>
                        <button 
                            className={styles.aiButton}
                            onClick={generateInsights}
                            disabled={generatingInsights}
                        >
                            {generatingInsights ? '🤖 Gerando...' : '🤖 Insights com IA'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className={styles.quickStats}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>📋</div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{metrics.totalRestaurants.toLocaleString()}</span>
                        <span className={styles.statLabel}>Total de Leads</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>🤖</div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{metrics.analyzedCount}</span>
                        <span className={styles.statLabel}>Analisados IA</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>✅</div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{metrics.qualifiedCount}</span>
                        <span className={styles.statLabel}>Qualificados</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>📈</div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{metrics.avgScore}</span>
                        <span className={styles.statLabel}>Score Médio</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>📦</div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{(metrics.totalProjectedDeliveries / 1000).toFixed(0)}K</span>
                        <span className={styles.statLabel}>Entregas/Mês</span>
                    </div>
                </div>
            </div>

            {/* Export Buttons */}
            <div className={styles.exportSection}>
                <h3>📥 Exportar Relatórios</h3>
                <div className={styles.exportButtons}>
                    <button 
                        className={styles.exportButton}
                        onClick={exportToExcel}
                        disabled={exportingExcel}
                    >
                        <span className={styles.exportIcon}>📊</span>
                        <div>
                            <span className={styles.exportTitle}>
                                {exportingExcel ? 'Exportando...' : 'Exportar Excel'}
                            </span>
                            <span className={styles.exportDesc}>Planilha completa com todas as abas</span>
                        </div>
                    </button>
                    <button 
                        className={styles.exportButton}
                        onClick={exportToPDF}
                        disabled={exportingPDF}
                    >
                        <span className={styles.exportIcon}>📄</span>
                        <div>
                            <span className={styles.exportTitle}>
                                {exportingPDF ? 'Gerando...' : 'Gerar PDF'}
                            </span>
                            <span className={styles.exportDesc}>Relatório formatado para impressão</span>
                        </div>
                    </button>
                    <button 
                        className={styles.exportButton}
                        onClick={() => {
                            const csv = metrics.topRestaurants.map(r => 
                                `${r.name},${r.score},${r.potential}`
                            ).join('\n');
                            const blob = new Blob([`Nome,Score,Potencial\n${csv}`], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'top_restaurantes.csv';
                            a.click();
                        }}
                    >
                        <span className={styles.exportIcon}>🏆</span>
                        <div>
                            <span className={styles.exportTitle}>Top Leads (CSV)</span>
                            <span className={styles.exportDesc}>Melhores oportunidades</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button 
                    className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Visão Geral
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'funnel' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('funnel')}
                >
                    🎯 Funil
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'regions' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('regions')}
                >
                    📍 Regiões
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'categories' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('categories')}
                >
                    🍽️ Categorias
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'ai' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('ai')}
                >
                    🤖 Insights IA
                </button>
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
                {activeTab === 'overview' && (
                    <div className={styles.overviewGrid}>
                        {/* Potential Distribution */}
                        <div className={styles.chartCard}>
                            <h3>🎯 Distribuição por Potencial</h3>
                            <div className={styles.potentialBars}>
                                <div className={styles.potentialItem}>
                                    <div className={styles.potentialLabel}>
                                        <span>🔥 Alto/Altíssimo</span>
                                        <span>{metrics.highPotentialCount}</span>
                                    </div>
                                    <div className={styles.potentialBar}>
                                        <div 
                                            className={styles.potentialFill} 
                                            style={{ 
                                                width: getProgressWidth((metrics.highPotentialCount / metrics.totalRestaurants) * 100),
                                                background: 'linear-gradient(90deg, #10b981, #059669)'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.potentialItem}>
                                    <div className={styles.potentialLabel}>
                                        <span>⚡ Médio</span>
                                        <span>{metrics.mediumPotentialCount}</span>
                                    </div>
                                    <div className={styles.potentialBar}>
                                        <div 
                                            className={styles.potentialFill} 
                                            style={{ 
                                                width: getProgressWidth((metrics.mediumPotentialCount / metrics.totalRestaurants) * 100),
                                                background: 'linear-gradient(90deg, #f59e0b, #d97706)'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.potentialItem}>
                                    <div className={styles.potentialLabel}>
                                        <span>💡 Baixo</span>
                                        <span>{metrics.lowPotentialCount}</span>
                                    </div>
                                    <div className={styles.potentialBar}>
                                        <div 
                                            className={styles.potentialFill} 
                                            style={{ 
                                                width: getProgressWidth((metrics.lowPotentialCount / metrics.totalRestaurants) * 100),
                                                background: 'linear-gradient(90deg, #6b7280, #4b5563)'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status Distribution */}
                        <div className={styles.chartCard}>
                            <h3>📋 Por Status</h3>
                            <div className={styles.statusList}>
                                {metrics.byStatus.map(s => (
                                    <div key={s.status} className={styles.statusItem}>
                                        <span className={styles.statusName}>{s.status}</span>
                                        <span className={styles.statusCount}>{s.count}</span>
                                        <div className={styles.statusBarContainer}>
                                            <div 
                                                className={styles.statusBar}
                                                style={{ width: getProgressWidth((s.count / metrics.totalRestaurants) * 100) }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Restaurants */}
                        <div className={styles.chartCard}>
                            <h3>🏆 Top 10 Restaurantes</h3>
                            <div className={styles.topList}>
                                {metrics.topRestaurants.map((r, i) => (
                                    <div key={i} className={styles.topItem}>
                                        <span className={styles.topRank}>#{i + 1}</span>
                                        <div className={styles.topInfo}>
                                            <span className={styles.topName}>{r.name}</span>
                                            <span className={styles.topPotential}>{r.potential}</span>
                                        </div>
                                        <span className={styles.topScore}>{r.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'funnel' && (
                    <div className={styles.funnelContainer}>
                        <h3>🎯 Funil de Conversão</h3>
                        <div className={styles.funnel}>
                            {metrics.conversionFunnel.map((stage, i) => (
                                <div 
                                    key={stage.stage} 
                                    className={styles.funnelStage}
                                    style={{ 
                                        width: `${100 - (i * 15)}%`,
                                        opacity: 1 - (i * 0.1)
                                    }}
                                >
                                    <div className={styles.funnelContent}>
                                        <span className={styles.funnelName}>{stage.stage}</span>
                                        <span className={styles.funnelCount}>{stage.count}</span>
                                        <span className={styles.funnelPercent}>{stage.percentage}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={styles.funnelLegend}>
                            <p>Taxa de conversão total: <strong>{metrics.conversionFunnel[metrics.conversionFunnel.length - 1]?.percentage || 0}%</strong></p>
                        </div>
                    </div>
                )}

                {activeTab === 'regions' && (
                    <div className={styles.regionContainer}>
                        <h3>📍 Leads por Região</h3>
                        <div className={styles.regionGrid}>
                            {metrics.byRegion.map(r => (
                                <div key={r.region} className={styles.regionCard}>
                                    <div className={styles.regionHeader}>
                                        <span className={styles.regionName}>{r.region}</span>
                                        <span className={styles.regionCount}>{r.count}</span>
                                    </div>
                                    <div className={styles.regionBar}>
                                        <div 
                                            className={styles.regionFill}
                                            style={{ 
                                                width: getProgressWidth((r.count / Math.max(...metrics.byRegion.map(x => x.count))) * 100)
                                            }}
                                        />
                                    </div>
                                    <span className={styles.regionPercent}>
                                        {Math.round((r.count / metrics.totalRestaurants) * 100)}% do total
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div className={styles.categoryContainer}>
                        <h3>🏙️ Leads por Cidade</h3>
                        <div className={styles.categoryGrid}>
                            {metrics.byCity.map(c => (
                                <div key={c.city} className={styles.categoryCard}>
                                    <div className={styles.categoryIcon}>📍</div>
                                    <span className={styles.categoryName}>{c.city}</span>
                                    <span className={styles.categoryCount}>{c.count} leads</span>
                                    <div className={styles.categoryBar}>
                                        <div 
                                            className={styles.categoryFill}
                                            style={{ 
                                                width: getProgressWidth((c.count / Math.max(...metrics.byCity.map(x => x.count))) * 100)
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className={styles.aiContainer}>
                        <div className={styles.aiHeader}>
                            <h3>🤖 Insights Gerados por IA</h3>
                            <button 
                                className={styles.regenerateButton}
                                onClick={generateInsights}
                                disabled={generatingInsights}
                            >
                                {generatingInsights ? '⏳ Gerando...' : '🔄 Regenerar'}
                            </button>
                        </div>
                        {aiInsights ? (
                            <div className={styles.aiContent}>
                                <div 
                                    className={styles.markdown}
                                    dangerouslySetInnerHTML={{ 
                                        __html: aiInsights
                                            .replace(/## (.*)/g, '<h2>$1</h2>')
                                            .replace(/### (.*)/g, '<h3>$1</h3>')
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\n- /g, '<br/>• ')
                                            .replace(/\n(\d+)\. /g, '<br/>$1. ')
                                            .replace(/\n\n/g, '<br/><br/>')
                                    }}
                                />
                            </div>
                        ) : (
                            <div className={styles.aiEmpty}>
                                <p>Clique em "🤖 Insights com IA" para gerar uma análise inteligente dos seus dados.</p>
                                <button 
                                    className={styles.generateButton}
                                    onClick={generateInsights}
                                    disabled={generatingInsights}
                                >
                                    {generatingInsights ? '⏳ Gerando Insights...' : '✨ Gerar Insights Agora'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

