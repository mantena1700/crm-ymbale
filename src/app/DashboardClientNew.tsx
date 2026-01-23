'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Restaurant } from '@/lib/types';
import styles from './DashboardNew.module.css';

interface DashboardStats {
    totalRestaurants: number;
    hotLeadsCount: number;
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

export default function DashboardClientNew({ stats }: DashboardClientProps) {
    const [greeting, setGreeting] = useState('Bom dia');
    const [currentTime, setCurrentTime] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Bom dia');
        else if (hour < 18) setGreeting('Boa tarde');
        else setGreeting('Boa noite');

        const updateTime = () => {
            setCurrentTime(new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, []);

    const conversionRate = stats.totalLeads > 0
        ? ((stats.closedDeals / stats.totalLeads) * 100).toFixed(1)
        : '0';

    const hotLeadsPercent = stats.totalLeads > 0
        ? Math.round((stats.hotLeadsCount / stats.totalLeads) * 100)
        : 0;

    // Sort regions by count
    const sortedRegions = Object.entries(stats.byRegion)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const maxRegionCount = sortedRegions.length > 0 ? sortedRegions[0][1] : 1;
    const totalPotential = stats.byPotential.altissimo + stats.byPotential.alto + stats.byPotential.medio + stats.byPotential.baixo;

    const formatTimeAgo = (timestamp: Date) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m atrás`;
        if (hours < 24) return `${hours}h atrás`;
        return `${days}d atrás`;
    };

    const getActivityIcon = (type: string) => {
        const icons: Record<string, string> = {
            'status_change': '🔄',
            'new_lead': '✨',
            'follow_up': '📅',
            'note': '📝',
            'analysis': '🤖'
        };
        return icons[type] || '📌';
    };

    return (
        <div style={{ padding: '0 0 40px 0' }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: 'var(--foreground)',
                    marginBottom: '4px'
                }}>
                    {greeting}! 👋
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    Hora de fazer negócio • {currentTime}
                </p>
            </div>

            {/* Hero Stats */}
            <div className={styles.heroStats}>
                <Link href="/clients" className={`${styles.heroCard} ${styles.heroBlue}`}>
                    <div className={styles.heroCardContent}>
                        <div className={styles.heroCardIcon}>📊</div>
                        <div className={styles.heroCardLabel}>Total de Leads</div>
                        <div className={styles.heroCardValue}>{stats.totalLeads.toLocaleString()}</div>
                        <div className={styles.heroCardTrend}>
                            📈 Base ativa
                        </div>
                    </div>
                </Link>

                <Link href="/pipeline?filter=hot" className={`${styles.heroCard} ${styles.heroGreen}`}>
                    <div className={styles.heroCardContent}>
                        <div className={styles.heroCardIcon}>🔥</div>
                        <div className={styles.heroCardLabel}>Leads Quentes</div>
                        <div className={styles.heroCardValue}>{stats.hotLeadsCount}</div>
                        <div className={styles.heroCardTrend}>
                            ⚡ {hotLeadsPercent}% do total
                        </div>
                    </div>
                </Link>

                <Link href="/agenda" className={`${styles.heroCard} ${styles.heroOrange}`}>
                    <div className={styles.heroCardContent}>
                        <div className={styles.heroCardIcon}>📅</div>
                        <div className={styles.heroCardLabel}>Follow-ups Hoje</div>
                        <div className={styles.heroCardValue}>{stats.todayFollowUps}</div>
                        <div className={styles.heroCardTrend}>
                            📋 {stats.pendingFollowUps} pendentes
                        </div>
                    </div>
                </Link>

                <Link href="/pipeline?filter=closed" className={`${styles.heroCard} ${styles.heroPurple}`}>
                    <div className={styles.heroCardContent}>
                        <div className={styles.heroCardIcon}>✅</div>
                        <div className={styles.heroCardLabel}>Taxa Conversão</div>
                        <div className={styles.heroCardValue}>{conversionRate}%</div>
                        <div className={styles.heroCardTrend}>
                            🎯 {stats.closedDeals} fechados
                        </div>
                    </div>
                </Link>
            </div>

            {/* Action Cards */}
            <div className={styles.actionGrid}>
                <Link href="/packaging-analysis" className={styles.actionCard}>
                    <div className={`${styles.actionIcon} ${styles.warning}`}>⚠️</div>
                    <div className={styles.actionContent}>
                        <div className={styles.actionTitle}>Aguardando Análise IA</div>
                        <div className={styles.actionSubtitle}>Leads precisam ser analisados</div>
                    </div>
                    <div className={`${styles.actionBadge} ${stats.pendingAnalysis > 10 ? styles.urgent : ''}`}>
                        {stats.pendingAnalysis}
                    </div>
                </Link>

                <Link href="/agenda" className={styles.actionCard}>
                    <div className={`${styles.actionIcon} ${styles.info}`}>📅</div>
                    <div className={styles.actionContent}>
                        <div className={styles.actionTitle}>Follow-ups de Hoje</div>
                        <div className={styles.actionSubtitle}>Acompanhamentos agendados</div>
                    </div>
                    <div className={styles.actionBadge}>{stats.todayFollowUps}</div>
                </Link>

                <Link href="/pipeline?status=Negociação" className={styles.actionCard}>
                    <div className={`${styles.actionIcon} ${styles.success}`}>🤝</div>
                    <div className={styles.actionContent}>
                        <div className={styles.actionTitle}>Em Negociação</div>
                        <div className={styles.actionSubtitle}>Leads prontos para fechar</div>
                    </div>
                    <div className={styles.actionBadge}>{stats.negotiatingLeads}</div>
                </Link>
            </div>

            {/* Pipeline Visual */}
            <div className={styles.pipelineSection}>
                <div className={styles.pipelineHeader}>
                    <h2 className={styles.pipelineTitle}>🚀 Pipeline de Vendas</h2>
                    <Link href="/pipeline" className={styles.pipelineLink}>
                        Ver detalhes →
                    </Link>
                </div>

                <div className={styles.pipelineFlow}>
                    <div className={styles.pipelineStage}>
                        <div className={`${styles.stageIcon} ${styles.analyze}`}>📝</div>
                        <div className={styles.stageName}>A Analisar</div>
                        <div className={styles.stageValue}>{stats.pendingAnalysis}</div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={`${styles.stageIcon} ${styles.qualified}`}>✅</div>
                        <div className={styles.stageName}>Qualificado</div>
                        <div className={styles.stageValue}>{stats.qualifiedLeads}</div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={`${styles.stageIcon} ${styles.contacted}`}>📞</div>
                        <div className={styles.stageName}>Contatado</div>
                        <div className={styles.stageValue}>{stats.contactedLeads}</div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={`${styles.stageIcon} ${styles.negotiation}`}>🤝</div>
                        <div className={styles.stageName}>Negociação</div>
                        <div className={styles.stageValue}>{stats.negotiatingLeads}</div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={`${styles.stageIcon} ${styles.closed}`}>🏆</div>
                        <div className={styles.stageName}>Fechado</div>
                        <div className={styles.stageValue}>{stats.closedDeals}</div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
                {/* Potential Chart */}
                <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                        <h3 className={styles.chartTitle}>🎯 Potencial de Vendas</h3>
                    </div>
                    <div className={styles.potentialChart}>
                        <div className={styles.potentialItem}>
                            <span className={styles.potentialLabel}>🔥 Altíssimo</span>
                            <div className={styles.potentialBarContainer}>
                                <div
                                    className={`${styles.potentialBar} ${styles.fire}`}
                                    style={{ width: `${totalPotential > 0 ? (stats.byPotential.altissimo / totalPotential) * 100 : 0}%` }}
                                >
                                    {stats.byPotential.altissimo}
                                </div>
                            </div>
                        </div>
                        <div className={styles.potentialItem}>
                            <span className={styles.potentialLabel}>⚡ Alto</span>
                            <div className={styles.potentialBarContainer}>
                                <div
                                    className={`${styles.potentialBar} ${styles.hot}`}
                                    style={{ width: `${totalPotential > 0 ? (stats.byPotential.alto / totalPotential) * 100 : 0}%` }}
                                >
                                    {stats.byPotential.alto}
                                </div>
                            </div>
                        </div>
                        <div className={styles.potentialItem}>
                            <span className={styles.potentialLabel}>📊 Médio</span>
                            <div className={styles.potentialBarContainer}>
                                <div
                                    className={`${styles.potentialBar} ${styles.warm}`}
                                    style={{ width: `${totalPotential > 0 ? (stats.byPotential.medio / totalPotential) * 100 : 0}%` }}
                                >
                                    {stats.byPotential.medio}
                                </div>
                            </div>
                        </div>
                        <div className={styles.potentialItem}>
                            <span className={styles.potentialLabel}>📉 Baixo</span>
                            <div className={styles.potentialBarContainer}>
                                <div
                                    className={`${styles.potentialBar} ${styles.cold}`}
                                    style={{ width: `${totalPotential > 0 ? (stats.byPotential.baixo / totalPotential) * 100 : 0}%` }}
                                >
                                    {stats.byPotential.baixo}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Region Chart */}
                <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                        <h3 className={styles.chartTitle}>📍 Top Regiões</h3>
                    </div>
                    <div className={styles.regionChart}>
                        {sortedRegions.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>📍</div>
                                <p className={styles.emptyText}>Nenhuma região registrada</p>
                            </div>
                        ) : (
                            sortedRegions.map(([name, count], index) => (
                                <div key={name} className={styles.regionItem}>
                                    <div className={styles.regionRank}>{index + 1}</div>
                                    <div className={styles.regionName}>{name}</div>
                                    <div className={styles.regionCount}>{count}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Top Leads Table */}
            <div className={styles.leadsSection}>
                <div className={styles.tableWrapper}>
                    <div className={styles.tableHeader}>
                        <h3 className={styles.tableTitle}>🔥 Leads Prioritários</h3>
                        <Link href="/clients?potential=ALTÍSSIMO" className={styles.tableLink}>
                            Ver todos →
                        </Link>
                    </div>
                    <div className={styles.leadsList}>
                        {stats.topLeads.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>📋</div>
                                <p className={styles.emptyText}>Nenhum lead prioritário encontrado</p>
                            </div>
                        ) : (
                            stats.topLeads.slice(0, 8).map((lead) => (
                                <Link
                                    key={lead.id}
                                    href={`/restaurant/${lead.id}`}
                                    className={styles.leadItem}
                                >
                                    <div className={styles.leadInfo}>
                                        <span className={styles.leadName}>{lead.name}</span>
                                        <span className={styles.leadCity}>{lead.address?.city || 'N/A'}</span>
                                    </div>
                                    <div className={`${styles.leadPotential} ${lead.salesPotential === 'ALTÍSSIMO' ? styles.altissimo :
                                            lead.salesPotential === 'ALTO' ? styles.alto :
                                                lead.salesPotential === 'MÉDIO' ? styles.medio : styles.baixo
                                        }`}>
                                        {lead.salesPotential || 'N/A'}
                                    </div>
                                    <div className={styles.leadDeliveries}>
                                        📦 {lead.projectedDeliveries?.toLocaleString() || '0'}
                                    </div>
                                    <div className={styles.leadRating}>
                                        ⭐ {(lead.rating || 0).toFixed(1)}
                                    </div>
                                    <div className={styles.leadStatus}>
                                        {lead.status || 'A Analisar'}
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Activities and Quick Stats */}
            <div className={styles.activitiesSection}>
                {/* Recent Activities */}
                <div className={styles.activitiesCard}>
                    <div className={styles.chartHeader}>
                        <h3 className={styles.chartTitle}>📊 Atividades Recentes</h3>
                    </div>
                    <div className={styles.activitiesList}>
                        {stats.recentActivities.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>📋</div>
                                <p className={styles.emptyText}>Nenhuma atividade recente</p>
                            </div>
                        ) : (
                            stats.recentActivities.slice(0, 6).map((activity, index) => (
                                <div key={index} className={styles.activityItem}>
                                    <div className={styles.activityIcon}>
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className={styles.activityContent}>
                                        <div className={styles.activityText}>{activity.description}</div>
                                        <div className={styles.activityTime}>
                                            {formatTimeAgo(activity.timestamp)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className={styles.activitiesCard}>
                    <div className={styles.chartHeader}>
                        <h3 className={styles.chartTitle}>⚡ Resumo Rápido</h3>
                    </div>
                    <div className={styles.quickStats}>
                        <div className={styles.quickStatItem}>
                            <div className={styles.quickStatIcon}>⭐</div>
                            <div className={styles.quickStatContent}>
                                <div className={styles.quickStatValue}>{stats.avgRating}</div>
                                <div className={styles.quickStatLabel}>Avaliação Média</div>
                            </div>
                        </div>
                        <div className={styles.quickStatItem}>
                            <div className={styles.quickStatIcon}>🎯</div>
                            <div className={styles.quickStatContent}>
                                <div className={styles.quickStatValue}>{stats.negotiatingLeads}</div>
                                <div className={styles.quickStatLabel}>Em Negociação</div>
                            </div>
                        </div>
                        <div className={styles.quickStatItem}>
                            <div className={styles.quickStatIcon}>🏆</div>
                            <div className={styles.quickStatContent}>
                                <div className={styles.quickStatValue}>{stats.closedDeals}</div>
                                <div className={styles.quickStatLabel}>Negócios Fechados</div>
                            </div>
                        </div>
                        <div className={styles.quickStatItem}>
                            <div className={styles.quickStatIcon}>📅</div>
                            <div className={styles.quickStatContent}>
                                <div className={styles.quickStatValue}>{stats.pendingFollowUps}</div>
                                <div className={styles.quickStatLabel}>Follow-ups Pendentes</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
