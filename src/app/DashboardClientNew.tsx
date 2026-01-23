'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Restaurant } from '@/lib/types';
import { PageLayout, Card, Grid, StatCard, Badge, Button } from '@/components/PageLayout';
import { Table } from '@/components/Table';
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
    const [greeting, setGreeting] = useState('');
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

        return () => {
            clearInterval(interval);
        };
    }, []);

    const conversionRate = stats.totalLeads > 0
        ? ((stats.closedDeals / stats.totalLeads) * 100).toFixed(1)
        : '0';

    const hotLeadsPercent = stats.totalLeads > 0
        ? Math.round((stats.hotLeadsCount / stats.totalLeads) * 100)
        : 0;

    // Preparar dados para tabelas
    const topLeadsColumns = [
        {
            key: 'name',
            label: 'Restaurante',
            render: (value: string, row: Restaurant) => (
                <div className={styles.restaurantCell}>
                    <span className={styles.restaurantName}>{value}</span>
                    <span className={styles.restaurantCity}>{row.address?.city || 'N/A'}</span>
                </div>
            )
        },
        {
            key: 'salesPotential',
            label: 'Potencial',
            width: '120px',
            render: (value: string) => (
                <Badge variant={
                    value === 'ALTÍSSIMO' ? 'danger' :
                        value === 'ALTO' ? 'warning' :
                            value === 'MÉDIO' ? 'info' : 'default'
                }>
                    {value}
                </Badge>
            )
        },
        {
            key: 'projectedDeliveries',
            label: 'Entregas/dia',
            width: '100px',
            align: 'center' as const,
            render: (value: number) => <strong>{value}</strong>
        },
        {
            key: 'rating',
            label: 'Avaliação',
            width: '100px',
            align: 'center' as const,
            render: (value: number) => `⭐ ${value.toFixed(1)}`
        }
    ];

    const recentActivitiesColumns = [
        {
            key: 'type',
            label: 'Ação',
            width: '60px',
            render: (value: string) => {
                const icons: Record<string, string> = {
                    'status_change': '🔄',
                    'new_lead': '✨',
                    'follow_up': '📅',
                    'note': '📝'
                };
                return <span className={styles.activityIcon}>{icons[value] || '📌'}</span>;
            }
        },
        {
            key: 'description',
            label: 'Descrição'
        },
        {
            key: 'timestamp',
            label: 'Quando',
            width: '120px',
            render: (value: Date) => {
                const diff = Date.now() - new Date(value).getTime();
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);

                if (minutes < 60) return `${minutes}m atrás`;
                if (hours < 24) return `${hours}h atrás`;
                return `${days}d atrás`;
            }
        }
    ];

    return (
        <PageLayout
            title={`${greeting}! 👋`}
            subtitle={`Hora de fazer negócio • ${currentTime}`}
            actions={
                <>
                    <Button variant="secondary" onClick={() => window.location.href = '/packaging-analysis'}>
                        🤖 Análise IA
                    </Button>
                    <Button variant="primary" onClick={() => window.location.href = '/clients'}>
                        ➕ Novo Lead
                    </Button>
                </>
            }
        >
            {/* KPIs Principais */}
            <Grid cols={4}>
                <StatCard
                    icon="📊"
                    label="Total de Leads"
                    value={stats.totalLeads}
                    trend="up"
                    trendValue="+12% este mês"
                    color="linear-gradient(135deg, #6366f1, #8b5cf6)"
                />
                <StatCard
                    icon="🔥"
                    label="Leads Quentes"
                    value={stats.hotLeadsCount}
                    trend="up"
                    trendValue={`${hotLeadsPercent}% do total`}
                    color="linear-gradient(135deg, #22c55e, #10b981)"
                />
                <StatCard
                    icon="📅"
                    label="Follow-ups Hoje"
                    value={stats.todayFollowUps}
                    trend="neutral"
                    trendValue={`${stats.pendingFollowUps} pendentes`}
                    color="linear-gradient(135deg, #f59e0b, #d97706)"
                />
                <StatCard
                    icon="✅"
                    label="Taxa de Conversão"
                    value={`${conversionRate}%`}
                    trend="up"
                    trendValue={`${stats.closedDeals} fechados`}
                    color="linear-gradient(135deg, #3b82f6, #2563eb)"
                />
            </Grid>

            {/* Alertas e Ações Rápidas */}
            <div className={styles.alertsGrid}>
                <Card className={styles.alertCard} title={undefined}>
                    <div className={styles.alert} data-variant="warning">
                        <span className={styles.alertIcon}>⚠️</span>
                        <div className={styles.alertContent}>
                            <strong>{stats.pendingAnalysis}</strong> leads aguardando análise IA
                        </div>
                        <Link href="/packaging-analysis" className={styles.alertAction}>
                            Analisar →
                        </Link>
                    </div>
                </Card>

                <Card className={styles.alertCard} title={undefined}>
                    <div className={styles.alert} data-variant="info">
                        <span className={styles.alertIcon}>📅</span>
                        <div className={styles.alertContent}>
                            <strong>{stats.todayFollowUps}</strong> follow-ups para hoje
                        </div>
                        <Link href="/agenda" className={styles.alertAction}>
                            Ver Agenda →
                        </Link>
                    </div>
                </Card>

                <Card className={styles.alertCard} title={undefined}>
                    <div className={styles.alert} data-variant="success">
                        <span className={styles.alertIcon}>🎯</span>
                        <div className={styles.alertContent}>
                            <strong>{stats.negotiatingLeads}</strong> leads em negociação
                        </div>
                        <Link href="/pipeline" className={styles.alertAction}>
                            Acompanhar →
                        </Link>
                    </div>
                </Card>
            </div>

            {/* Pipeline Overview */}
            <Card title="Pipeline de Vendas">
                <div className={styles.pipelineGrid}>
                    <div className={styles.pipelineStage}>
                        <div className={styles.stageHeader}>
                            <span className={styles.stageIcon}>📝</span>
                            <span className={styles.stageName}>A Analisar</span>
                        </div>
                        <div className={styles.stageValue}>{stats.pendingAnalysis}</div>
                        <div className={styles.stageBar} style={{ background: '#94a3b8' }}></div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={styles.stageHeader}>
                            <span className={styles.stageIcon}>✅</span>
                            <span className={styles.stageName}>Qualificado</span>
                        </div>
                        <div className={styles.stageValue}>{stats.qualifiedLeads}</div>
                        <div className={styles.stageBar} style={{ background: '#3b82f6' }}></div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={styles.stageHeader}>
                            <span className={styles.stageIcon}>📞</span>
                            <span className={styles.stageName}>Contatado</span>
                        </div>
                        <div className={styles.stageValue}>{stats.contactedLeads}</div>
                        <div className={styles.stageBar} style={{ background: '#10b981' }}></div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={styles.stageHeader}>
                            <span className={styles.stageIcon}>🤝</span>
                            <span className={styles.stageName}>Negociação</span>
                        </div>
                        <div className={styles.stageValue}>{stats.negotiatingLeads}</div>
                        <div className={styles.stageBar} style={{ background: '#f59e0b' }}></div>
                    </div>

                    <div className={styles.pipelineStage}>
                        <div className={styles.stageHeader}>
                            <span className={styles.stageIcon}>🎉</span>
                            <span className={styles.stageName}>Fechado</span>
                        </div>
                        <div className={styles.stageValue}>{stats.closedDeals}</div>
                        <div className={styles.stageBar} style={{ background: '#22c55e' }}></div>
                    </div>
                </div>
            </Card>

            {/* Distribuição por Potencial */}
            <Grid cols={2}>
                <Card title="📈 Distribuição por Potencial">
                    <div className={styles.potentialChart}>
                        <div className={styles.potentialItem}>
                            <div className={styles.potentialLabel}>
                                <Badge variant="danger">ALTÍSSIMO</Badge>
                            </div>
                            <div className={styles.potentialBar}>
                                <div
                                    className={styles.potentialFill}
                                    style={{
                                        width: `${(stats.byPotential.altissimo / stats.totalLeads) * 100}%`,
                                        background: '#ef4444'
                                    }}
                                ></div>
                            </div>
                            <div className={styles.potentialValue}>{stats.byPotential.altissimo}</div>
                        </div>

                        <div className={styles.potentialItem}>
                            <div className={styles.potentialLabel}>
                                <Badge variant="warning">ALTO</Badge>
                            </div>
                            <div className={styles.potentialBar}>
                                <div
                                    className={styles.potentialFill}
                                    style={{
                                        width: `${(stats.byPotential.alto / stats.totalLeads) * 100}%`,
                                        background: '#f59e0b'
                                    }}
                                ></div>
                            </div>
                            <div className={styles.potentialValue}>{stats.byPotential.alto}</div>
                        </div>

                        <div className={styles.potentialItem}>
                            <div className={styles.potentialLabel}>
                                <Badge variant="info">MÉDIO</Badge>
                            </div>
                            <div className={styles.potentialBar}>
                                <div
                                    className={styles.potentialFill}
                                    style={{
                                        width: `${(stats.byPotential.medio / stats.totalLeads) * 100}%`,
                                        background: '#3b82f6'
                                    }}
                                ></div>
                            </div>
                            <div className={styles.potentialValue}>{stats.byPotential.medio}</div>
                        </div>

                        <div className={styles.potentialItem}>
                            <div className={styles.potentialLabel}>
                                <Badge>BAIXO</Badge>
                            </div>
                            <div className={styles.potentialBar}>
                                <div
                                    className={styles.potentialFill}
                                    style={{
                                        width: `${(stats.byPotential.baixo / stats.totalLeads) * 100}%`,
                                        background: '#94a3b8'
                                    }}
                                ></div>
                            </div>
                            <div className={styles.potentialValue}>{stats.byPotential.baixo}</div>
                        </div>
                    </div>
                </Card>

                <Card title="🗺️ Leads por Região">
                    <div className={styles.regionList}>
                        {Object.entries(stats.byRegion)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 8)
                            .map(([city, count]) => (
                                <div key={city} className={styles.regionItem}>
                                    <span className={styles.regionName}>{city}</span>
                                    <div className={styles.regionBar}>
                                        <div
                                            className={styles.regionFill}
                                            style={{
                                                width: `${(count / stats.totalLeads) * 100}%`
                                            }}
                                        ></div>
                                    </div>
                                    <span className={styles.regionCount}>{count}</span>
                                </div>
                            ))}
                    </div>
                </Card>
            </Grid>

            {/* Top Leads */}
            <Card
                title="🏆 Top Leads (Altíssimo Potencial)"
                actions={
                    <Link href="/clients" className={styles.cardLink}>
                        Ver todos →
                    </Link>
                }
            >
                <Table
                    columns={topLeadsColumns}
                    data={stats.topLeads.slice(0, 10)}
                    emptyMessage="Nenhum lead com alto potencial"
                    onRowClick={(row) => window.location.href = `/restaurant/${row.id}`}
                />
            </Card>

            {/* Atividades Recentes */}
            <Card title="📝 Atividades Recentes">
                <Table
                    columns={recentActivitiesColumns}
                    data={stats.recentActivities}
                    emptyMessage="Nenhuma atividade recente"
                />
            </Card>

            {/* Próximos Follow-ups */}
            {stats.upcomingFollowUps && stats.upcomingFollowUps.length > 0 && (
                <Card title="📅 Próximos Follow-ups">
                    <div className={styles.followUpsList}>
                        {stats.upcomingFollowUps.map((followUp: any, index: number) => (
                            <div key={index} className={styles.followUpItem}>
                                <div className={styles.followUpDate}>
                                    {new Date(followUp.scheduledDate).toLocaleDateString('pt-BR', {
                                        day: '2-digit',
                                        month: 'short'
                                    })}
                                </div>
                                <div className={styles.followUpContent}>
                                    <div className={styles.followUpTitle}>
                                        {followUp.restaurantName}
                                    </div>
                                    <div className={styles.followUpDescription}>
                                        {followUp.description || 'Follow-up agendado'}
                                    </div>
                                </div>
                                <Link
                                    href={`/restaurant/${followUp.restaurantId}`}
                                    className={styles.followUpAction}
                                >
                                    Ver →
                                </Link>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </PageLayout>
    );
}

