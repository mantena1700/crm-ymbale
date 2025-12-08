'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Restaurant } from '@/lib/types';
import styles from './page.module.css';
import QuickViewModal from '@/components/QuickViewModal';
import { updateRestaurantStatus } from '@/app/actions';

interface DashboardStats {
    totalRestaurants: number;
    hotLeadsCount: number;
    projectedRevenue: number;
    hotLeads: Restaurant[];
    totalLeads: number;
    qualifiedLeads: number;
    contactedLeads: number;
    negotiatingLeads: number;
    closedDeals: number;
    pendingAnalysis: number;
    avgRating: string;
    byPotential: {
        altissimo: number;
        alto: number;
        medio: number;
        baixo: number;
    };
    byRegion: Record<string, number>;
    recentLeads: Restaurant[];
    topLeads: Restaurant[];
    pendingFollowUps: number;
    todayFollowUps: number;
    goals: any[];
    upcomingFollowUps: any[];
    recentActivities: any[];
}

interface DashboardClientProps {
    stats: DashboardStats;
}

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Agora';
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} hora${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''}`;
    if (diffInSeconds < 604800) return `Há ${Math.floor(diffInSeconds / 86400)} dia${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''}`;
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

export default function DashboardClient({ stats }: DashboardClientProps) {
    const [greeting, setGreeting] = useState('');
    const [currentTime, setCurrentTime] = useState('');
    const [animatedValues, setAnimatedValues] = useState({
        leads: 0,
        hot: 0,
        revenue: 0,
        qualified: 0
    });
    const [quickViewId, setQuickViewId] = useState<string | null>(null);
    const [topLeads, setTopLeads] = useState(stats.topLeads);

    // Find the restaurant for quick view
    const quickViewRestaurant = quickViewId ? topLeads.find(r => r.id === quickViewId) : null;

    // Handlers para QuickViewModal
    const handleQuickUpdateStatus = async (id: string, status: string) => {
        setTopLeads(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        await updateRestaurantStatus(id, status);
    };

    const handleQuickUpdatePriority = async (id: string, priority: string) => {
        setTopLeads(prev => prev.map(r => r.id === id ? { ...r, salesPotential: priority } : r));
    };

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Bom dia');
        else if (hour < 18) setGreeting('Boa tarde');
        else setGreeting('Boa noite');

        const updateTime = () => {
            setCurrentTime(new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    // Animate numbers on load
    useEffect(() => {
        const duration = 1500;
        const steps = 60;
        const stepTime = duration / steps;

        let step = 0;
        const timer = setInterval(() => {
            step++;
            const progress = step / steps;
            const eased = 1 - Math.pow(1 - progress, 3);

            setAnimatedValues({
                leads: Math.floor(stats.totalLeads * eased),
                hot: Math.floor(stats.byPotential.altissimo * eased),
                revenue: Math.floor((stats.projectedRevenue / 1000) * eased),
                qualified: Math.floor(stats.qualifiedLeads * eased)
            });

            if (step >= steps) clearInterval(timer);
        }, stepTime);

        return () => clearInterval(timer);
    }, [stats]);

    // Calculate metrics
    const conversionRate = stats.totalLeads > 0
        ? ((stats.closedDeals / stats.totalLeads) * 100).toFixed(1)
        : '0';

    const qualificationRate = stats.totalLeads > 0
        ? ((stats.qualifiedLeads / stats.totalLeads) * 100).toFixed(1)
        : '0';

    const hotLeadsPercent = stats.totalLeads > 0
        ? ((stats.byPotential.altissimo / stats.totalLeads) * 100).toFixed(1)
        : '0';

    // Get top regions
    const topRegions = Object.entries(stats.byRegion)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    // Pipeline stages for funnel
    const pipeline = [
        { stage: 'A Analisar', count: stats.pendingAnalysis, color: '#6366f1', icon: '🔍', percent: ((stats.pendingAnalysis / stats.totalLeads) * 100).toFixed(0) },
        { stage: 'Qualificados', count: stats.qualifiedLeads, color: '#10b981', icon: '✅', percent: ((stats.qualifiedLeads / stats.totalLeads) * 100).toFixed(0) },
        { stage: 'Contatados', count: stats.contactedLeads, color: '#f59e0b', icon: '📞', percent: ((stats.contactedLeads / stats.totalLeads) * 100).toFixed(0) },
        { stage: 'Negociação', count: stats.negotiatingLeads, color: '#8b5cf6', icon: '🤝', percent: ((stats.negotiatingLeads / stats.totalLeads) * 100).toFixed(0) },
        { stage: 'Fechados', count: stats.closedDeals, color: '#22c55e', icon: '🎉', percent: ((stats.closedDeals / stats.totalLeads) * 100).toFixed(0) },
    ];

    // Performance indicators
    const performanceScore = Math.min(100, Math.round(
        (parseFloat(qualificationRate) * 0.3) +
        (parseFloat(hotLeadsPercent) * 0.4) +
        (parseFloat(conversionRate) * 0.3)
    ));

    return (
        <div className={styles.container}>
            {/* Hero Header */}
            <header className={styles.heroHeader}>
                <div className={styles.heroBackground}></div>
                <div className={styles.heroContent}>
                    <div className={styles.heroLeft}>
                        <span className={styles.welcomeBadge}>👋 Bem-vindo de volta</span>
                        <h1>{greeting}, <span className={styles.userName}>Admin</span>!</h1>
                        <p>Seu CRM está trabalhando por você. Veja as atualizações do dia.</p>
                        <div className={styles.heroActions}>
                            <Link href="/pipeline" className={styles.primaryBtn}>
                                🚀 Ver Pipeline
                            </Link>
                            <Link href="/batch-analysis" className={styles.secondaryBtn}>
                                🤖 Analisar Leads
                            </Link>
                        </div>
                    </div>
                    <div className={styles.heroRight}>
                        <div className={styles.clockWidget}>
                            <div className={styles.clockTime}>{currentTime}</div>
                            <div className={styles.clockDate}>
                                {new Date().toLocaleDateString('pt-BR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </div>
                        </div>
                        <div className={styles.performanceWidget}>
                            <div className={styles.performanceCircle}>
                                <svg viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                    <circle
                                        cx="50" cy="50" r="45"
                                        fill="none"
                                        stroke="url(#gradient)"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeDasharray={`${performanceScore * 2.83} 283`}
                                        transform="rotate(-90 50 50)"
                                    />
                                    <defs>
                                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#6366f1" />
                                            <stop offset="100%" stopColor="#8b5cf6" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className={styles.performanceValue}>{performanceScore}%</div>
                            </div>
                            <span className={styles.performanceLabel}>Performance</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Stats Grid */}
            <div className={styles.mainStats}>
                <div className={`${styles.statCard} ${styles.statPrimary}`}>
                    <div className={styles.statGlow}></div>
                    <div className={styles.statHeader}>
                        <span className={styles.statIcon}>📊</span>
                        <span className={styles.statTrend}>
                            <span className={styles.trendUp}>↑ 12%</span>
                        </span>
                    </div>
                    <div className={styles.statValue}>{animatedValues.leads.toLocaleString()}</div>
                    <div className={styles.statLabel}>Total de Leads</div>
                    <div className={styles.statMini}>
                        <span>+45 esta semana</span>
                    </div>
                </div>

                <div className={`${styles.statCard} ${styles.statSuccess}`}>
                    <div className={styles.statGlow}></div>
                    <div className={styles.statHeader}>
                        <span className={styles.statIcon}>🔥</span>
                        <span className={styles.statTrend}>
                            <span className={styles.trendUp}>↑ 8%</span>
                        </span>
                    </div>
                    <div className={styles.statValue}>{animatedValues.hot}</div>
                    <div className={styles.statLabel}>Leads Quentes</div>
                    <div className={styles.statProgress}>
                        <div className={styles.progressBar}>
                            <div style={{ width: `${hotLeadsPercent}%`, background: '#22c55e' }}></div>
                        </div>
                        <span>{hotLeadsPercent}% do total</span>
                    </div>
                </div>

                <div className={`${styles.statCard} ${styles.statWarning}`}>
                    <div className={styles.statGlow}></div>
                    <div className={styles.statHeader}>
                        <span className={styles.statIcon}>💰</span>
                        <span className={styles.statTrend}>
                            <span className={styles.trendUp}>↑ 15%</span>
                        </span>
                    </div>
                    <div className={styles.statValue}>R$ {animatedValues.revenue}K</div>
                    <div className={styles.statLabel}>Receita Projetada</div>
                    <div className={styles.statMini}>
                        <span>Meta: R$ 6.000K</span>
                    </div>
                </div>

                <div className={`${styles.statCard} ${styles.statInfo}`}>
                    <div className={styles.statGlow}></div>
                    <div className={styles.statHeader}>
                        <span className={styles.statIcon}>✅</span>
                        <span className={styles.statTrend}>
                            <span className={styles.trendUp}>↑ 5%</span>
                        </span>
                    </div>
                    <div className={styles.statValue}>{animatedValues.qualified}</div>
                    <div className={styles.statLabel}>Qualificados</div>
                    <div className={styles.statProgress}>
                        <div className={styles.progressBar}>
                            <div style={{ width: `${qualificationRate}%`, background: '#3b82f6' }}></div>
                        </div>
                        <span>{qualificationRate}% taxa</span>
                    </div>
                </div>
            </div>

            {/* KPI Alerts Row */}
            <div className={styles.alertsRow}>
                <div className={`${styles.alertCard} ${styles.alertUrgent}`}>
                    <span className={styles.alertIcon}>⚠️</span>
                    <div className={styles.alertContent}>
                        <strong>{stats.pendingAnalysis}</strong> leads aguardando análise IA
                    </div>
                    <Link href="/batch-analysis" className={styles.alertAction}>Analisar →</Link>
                </div>
                <div className={`${styles.alertCard} ${styles.alertInfo}`}>
                    <span className={styles.alertIcon}>📅</span>
                    <div className={styles.alertContent}>
                        <strong>{stats.pendingFollowUps}</strong> follow-ups pendentes
                    </div>
                    <Link href="/agenda" className={styles.alertAction}>Ver Agenda →</Link>
                </div>
                <div className={`${styles.alertCard} ${styles.alertSuccess}`}>
                    <span className={styles.alertIcon}>🎯</span>
                    <div className={styles.alertContent}>
                        <strong>{stats.negotiatingLeads}</strong> leads em negociação
                    </div>
                    <Link href="/pipeline" className={styles.alertAction}>Ver Pipeline →</Link>
                </div>
            </div>

            {/* Main Grid */}
            <div className={styles.mainGrid}>
                {/* Funnel Section */}
                <div className={`${styles.card} ${styles.funnelCard}`}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitleGroup}>
                            <h2>🎯 Funil de Vendas</h2>
                            <span className={styles.cardBadge}>{stats.totalLeads} leads</span>
                        </div>
                        <Link href="/pipeline" className={styles.cardLink}>Ver Pipeline →</Link>
                    </div>
                    <div className={styles.funnelVisual}>
                        {pipeline.map((stage, index) => (
                            <div key={stage.stage} className={styles.funnelStep}>
                                <div
                                    className={styles.funnelBar}
                                    style={{
                                        width: `${100 - (index * 15)}%`,
                                        background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`
                                    }}
                                >
                                    <span className={styles.funnelStageIcon}>{stage.icon}</span>
                                    <span className={styles.funnelStageName}>{stage.stage}</span>
                                    <span className={styles.funnelStageCount}>{stage.count}</span>
                                    <span className={styles.funnelStagePercent}>{stage.percent}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className={styles.funnelMetrics}>
                        <div className={styles.funnelMetric}>
                            <span className={styles.metricValue}>{conversionRate}%</span>
                            <span className={styles.metricLabel}>Taxa Conversão</span>
                        </div>
                        <div className={styles.funnelMetric}>
                            <span className={styles.metricValue}>{qualificationRate}%</span>
                            <span className={styles.metricLabel}>Taxa Qualificação</span>
                        </div>
                        <div className={styles.funnelMetric}>
                            <span className={styles.metricValue}>{stats.avgRating}⭐</span>
                            <span className={styles.metricLabel}>Rating Médio</span>
                        </div>
                        <div className={styles.funnelMetric}>
                            <span className={styles.metricValue}>{hotLeadsPercent}%</span>
                            <span className={styles.metricLabel}>Leads Quentes</span>
                        </div>
                    </div>
                </div>

                {/* Potential Distribution */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>📊 Potencial de Vendas</h2>
                    </div>
                    <div className={styles.donutContainer}>
                        <div className={styles.donutChart}>
                            <svg viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="20" />
                                {(() => {
                                    const total = stats.totalLeads || 1;
                                    const segments = [
                                        { value: stats.byPotential.altissimo, color: '#22c55e' },
                                        { value: stats.byPotential.alto, color: '#f59e0b' },
                                        { value: stats.byPotential.medio, color: '#6366f1' },
                                        { value: stats.byPotential.baixo, color: '#6b7280' },
                                    ];
                                    let offset = 0;
                                    return segments.map((seg, i) => {
                                        const percent = (seg.value / total) * 251.2;
                                        const element = (
                                            <circle
                                                key={i}
                                                cx="50" cy="50" r="40"
                                                fill="none"
                                                stroke={seg.color}
                                                strokeWidth="20"
                                                strokeDasharray={`${percent} 251.2`}
                                                strokeDashoffset={-offset}
                                                transform="rotate(-90 50 50)"
                                            />
                                        );
                                        offset += percent;
                                        return element;
                                    });
                                })()}
                            </svg>
                            <div className={styles.donutCenter}>
                                <span className={styles.donutTotal}>{stats.totalLeads}</span>
                                <span className={styles.donutLabel}>Total</span>
                            </div>
                        </div>
                        <div className={styles.donutLegend}>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: '#22c55e' }}></span>
                                <span className={styles.legendLabel}>Altíssimo</span>
                                <span className={styles.legendValue}>{stats.byPotential.altissimo}</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: '#f59e0b' }}></span>
                                <span className={styles.legendLabel}>Alto</span>
                                <span className={styles.legendValue}>{stats.byPotential.alto}</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: '#6366f1' }}></span>
                                <span className={styles.legendLabel}>Médio</span>
                                <span className={styles.legendValue}>{stats.byPotential.medio}</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: '#6b7280' }}></span>
                                <span className={styles.legendLabel}>Baixo</span>
                                <span className={styles.legendValue}>{stats.byPotential.baixo}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Leads Table */}
                <div className={`${styles.card} ${styles.cardWide}`}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitleGroup}>
                            <h2>🏆 Top 10 Leads Prioritários</h2>
                            <span className={styles.cardBadge}>Ordenado por potencial</span>
                        </div>
                        <Link href="/clients" className={styles.cardLink}>Ver Todos →</Link>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Restaurante</th>
                                    <th>Localização</th>
                                    <th>Rating</th>
                                    <th>Entregas/Mês</th>
                                    <th>Potencial</th>
                                    <th>Status</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topLeads.map((lead, index) => (
                                    <tr key={lead.id} className={index < 3 ? styles.topThree : ''}>
                                        <td>
                                            <span className={`${styles.rank} ${styles[`rank${index + 1}`]}`}>
                                                {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.leadCell}>
                                                <strong>{lead.name}</strong>
                                                <span>{lead.category || 'Restaurante'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={styles.location}>
                                                📍 {lead.address?.city || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.ratingCell}>
                                                <span className={styles.ratingStars}>{'⭐'.repeat(Math.round(lead.rating))}</span>
                                                <span>{lead.rating}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={styles.deliveries}>
                                                📦 {lead.projectedDeliveries.toLocaleString()}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`${styles.potentialBadge} ${styles[`potential${lead.salesPotential?.replace(/Í/g, 'I')}`]}`}>
                                                {lead.salesPotential === 'ALTÍSSIMO' ? '🔥' : lead.salesPotential === 'ALTO' ? '⚡' : '📊'} {lead.salesPotential}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={styles.statusBadge}>
                                                {lead.status || 'A Analisar'}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => setQuickViewId(lead.id)}
                                                className={styles.viewBtn}
                                            >
                                                👁️ Ver
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Regions & Actions */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>📍 Distribuição Regional</h2>
                    </div>
                    <div className={styles.regionsList}>
                        {topRegions.map(([city, count], index) => {
                            const percent = ((count / stats.totalLeads) * 100).toFixed(1);
                            return (
                                <div key={city} className={styles.regionItem}>
                                    <div className={styles.regionHeader}>
                                        <span className={styles.regionRank}>#{index + 1}</span>
                                        <span className={styles.regionName}>{city}</span>
                                        <span className={styles.regionCount}>{count} leads</span>
                                    </div>
                                    <div className={styles.regionBar}>
                                        <div
                                            className={styles.regionFill}
                                            style={{
                                                width: `${(count / topRegions[0][1]) * 100}%`,
                                                background: `linear-gradient(90deg, hsl(${260 - index * 25}, 70%, 60%), hsl(${260 - index * 25}, 70%, 50%))`
                                            }}
                                        >
                                            <span>{percent}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>⚡ Centro de Ações</h2>
                    </div>
                    <div className={styles.actionsHub}>
                        <Link href="/batch-analysis" className={`${styles.actionHubItem} ${styles.actionAI}`}>
                            <div className={styles.actionHubIcon}>🤖</div>
                            <div className={styles.actionHubContent}>
                                <strong>Análise IA</strong>
                                <span>{stats.pendingAnalysis} pendentes</span>
                            </div>
                            <span className={styles.actionArrow}>→</span>
                        </Link>
                        <Link href="/reports" className={`${styles.actionHubItem} ${styles.actionReports}`}>
                            <div className={styles.actionHubIcon}>📊</div>
                            <div className={styles.actionHubContent}>
                                <strong>Relatórios</strong>
                                <span>Exportar dados</span>
                            </div>
                            <span className={styles.actionArrow}>→</span>
                        </Link>
                        <Link href="/agenda" className={`${styles.actionHubItem} ${styles.actionAgenda}`}>
                            <div className={styles.actionHubIcon}>📅</div>
                            <div className={styles.actionHubContent}>
                                <strong>Agenda</strong>
                                <span>{stats.pendingFollowUps} follow-ups</span>
                            </div>
                            <span className={styles.actionArrow}>→</span>
                        </Link>
                        <Link href="/goals" className={`${styles.actionHubItem} ${styles.actionGoals}`}>
                            <div className={styles.actionHubIcon}>🎯</div>
                            <div className={styles.actionHubContent}>
                                <strong>Metas</strong>
                                <span>Ver progresso</span>
                            </div>
                            <span className={styles.actionArrow}>→</span>
                        </Link>
                        <Link href="/campaigns" className={`${styles.actionHubItem} ${styles.actionCampaigns}`}>
                            <div className={styles.actionHubIcon}>📣</div>
                            <div className={styles.actionHubContent}>
                                <strong>Campanhas</strong>
                                <span>Criar nova</span>
                            </div>
                            <span className={styles.actionArrow}>→</span>
                        </Link>
                        <Link href="/settings" className={`${styles.actionHubItem} ${styles.actionSettings}`}>
                            <div className={styles.actionHubIcon}>⚙️</div>
                            <div className={styles.actionHubContent}>
                                <strong>Configurações</strong>
                                <span>IA & Sistema</span>
                            </div>
                            <span className={styles.actionArrow}>→</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className={styles.bottomGrid}>
                {/* Activity Timeline */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>🕐 Timeline de Atividades</h2>
                        <span className={styles.liveBadge}>
                            <span className={styles.liveDot}></span>
                            Ao vivo
                        </span>
                    </div>
                    <div className={styles.timeline}>
                        {stats.recentActivities.length > 0 ? (
                            stats.recentActivities.slice(0, 4).map((activity, index) => {
                                const timeAgo = getTimeAgo(new Date(activity.timestamp));
                                const icons = {
                                    analysis: { icon: '🤖', color: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
                                    qualification: { icon: '✅', color: 'linear-gradient(135deg, #10b981, #34d399)' },
                                    followup: { icon: '📞', color: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
                                    email: { icon: '📧', color: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
                                    status_change: { icon: '🔄', color: 'linear-gradient(135deg, #3b82f6, #60a5fa)' }
                                };
                                const activityIcon = icons[activity.type as keyof typeof icons] || icons.analysis;

                                return (
                                    <div key={activity.id} className={styles.timelineItem}>
                                        <div className={styles.timelineIcon} style={{ background: activityIcon.color }}>
                                            {activityIcon.icon}
                                        </div>
                                        {index < stats.recentActivities.slice(0, 4).length - 1 && <div className={styles.timelineLine}></div>}
                                        <div className={styles.timelineContent}>
                                            <div className={styles.timelineHeader}>
                                                <strong>{activity.title}</strong>
                                                <span className={styles.timelineTime} suppressHydrationWarning>{timeAgo}</span>
                                            </div>
                                            <p>{activity.description}</p>
                                            {activity.metadata && (
                                                <div className={styles.timelineTags}>
                                                    {activity.metadata.score && (
                                                        <span className={styles.timelineTag}>Score: {activity.metadata.score}</span>
                                                    )}
                                                    {activity.metadata.city && (
                                                        <span className={styles.timelineTag}>{activity.metadata.city}</span>
                                                    )}
                                                    {activity.metadata.painPoints && activity.metadata.painPoints.map((point: string, i: number) => (
                                                        <span key={i} className={styles.timelineTag}>{point}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className={styles.emptyState}>
                                <p>Nenhuma atividade recente</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upcoming Tasks */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>📅 Próximas Tarefas</h2>
                        <Link href="/agenda" className={styles.cardLink}>Ver Agenda →</Link>
                    </div>
                    <div className={styles.tasksList}>
                        {stats.upcomingFollowUps.length > 0 ? (
                            stats.upcomingFollowUps.slice(0, 3).map((followUp) => {
                                const scheduledDate = new Date(followUp.scheduledDate);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const followUpDate = new Date(scheduledDate);
                                followUpDate.setHours(0, 0, 0, 0);
                                const isToday = followUpDate.getTime() === today.getTime();
                                const isTomorrow = followUpDate.getTime() === new Date(today.getTime() + 86400000).getTime();

                                const typeIcons = {
                                    call: '📞 Ligação',
                                    email: '📧 Email',
                                    meeting: '🤝 Reunião',
                                    whatsapp: '💬 WhatsApp'
                                };

                                return (
                                    <div key={followUp.id} className={`${styles.taskItem} ${isToday ? styles.taskUrgent : ''}`}>
                                        <div className={styles.taskTime}>
                                            <span className={styles.taskHour}>
                                                {scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className={styles.taskPeriod}>
                                                {isToday ? 'HOJE' : isTomorrow ? 'AMANHÃ' : scheduledDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        <div className={styles.taskContent}>
                                            <div className={styles.taskType}>{typeIcons[followUp.type as keyof typeof typeIcons] || '📅 Tarefa'}</div>
                                            <strong>{followUp.restaurantName || 'Restaurante'}</strong>
                                            <p>{followUp.notes || followUp.emailSubject || 'Sem descrição'}</p>
                                        </div>
                                        <Link href={`/restaurant/${followUp.restaurantId}`} className={styles.taskAction}>✓</Link>
                                    </div>
                                );
                            })
                        ) : (
                            <div className={styles.emptyState}>
                                <p>Nenhuma tarefa agendada</p>
                                <Link href="/agenda" className={styles.emptyStateLink}>Criar follow-up →</Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Insights */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>💡 Insights Rápidos</h2>
                        <Link href="/insights" className={styles.cardLink}>Ver Todos →</Link>
                    </div>
                    <div className={styles.insightsList}>
                        <div className={styles.insightItem}>
                            <div className={styles.insightIcon}>📈</div>
                            <div className={styles.insightContent}>
                                <strong>Taxa de qualificação subindo</strong>
                                <p>+5% comparado à semana passada. Continue assim!</p>
                            </div>
                        </div>
                        <div className={styles.insightItem}>
                            <div className={styles.insightIcon}>🎯</div>
                            <div className={styles.insightContent}>
                                <strong>Sorocaba é seu melhor mercado</strong>
                                <p>96% dos leads são desta região. Considere expandir.</p>
                            </div>
                        </div>
                        <div className={styles.insightItem}>
                            <div className={styles.insightIcon}>⚡</div>
                            <div className={styles.insightContent}>
                                <strong>{stats.pendingAnalysis} leads para analisar</strong>
                                <p>Use a análise em lote para acelerar o processo.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick View Modal */}
            {quickViewRestaurant && (
                <QuickViewModal
                    restaurant={{
                        id: quickViewRestaurant.id,
                        name: quickViewRestaurant.name,
                        rating: quickViewRestaurant.rating,
                        reviewCount: quickViewRestaurant.reviewCount,
                        category: quickViewRestaurant.category || null,
                        address: quickViewRestaurant.address,
                        status: quickViewRestaurant.status || 'A Analisar',
                        salesPotential: quickViewRestaurant.salesPotential,
                        projectedDeliveries: quickViewRestaurant.projectedDeliveries
                    }}
                    onClose={() => setQuickViewId(null)}
                    onUpdateStatus={handleQuickUpdateStatus}
                    onUpdatePriority={handleQuickUpdatePriority}
                />
            )}
        </div>
    );
}
