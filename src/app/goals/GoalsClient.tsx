'use client';

import { useState } from 'react';
import styles from './page.module.css';

interface Goal {
    id: string;
    name: string;
    description?: string;
    type: 'leads' | 'revenue' | 'conversions' | 'calls' | 'meetings' | 'custom' | 'clients' | 'conversion';
    target: number;
    current: number;
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    endDate: string;
    status: 'on_track' | 'at_risk' | 'behind' | 'completed' | 'active' | 'paused';
    team?: string;
}

interface Stats {
    totalLeads: number;
    qualifiedLeads: number;
    closedDeals: number;
    totalRevenue: number;
    avgDealSize: number;
    conversionRate: number;
}

interface GoalsClientProps {
    initialGoals: Goal[];
    stats: Stats;
}

export default function GoalsClient({ initialGoals, stats }: GoalsClientProps) {
    const [goals, setGoals] = useState<Goal[]>(initialGoals.length > 0 ? initialGoals : [
        {
            id: '1',
            name: 'Leads Qualificados',
            description: 'Qualificar novos leads através da análise IA',
            type: 'leads',
            target: 500,
            current: stats.qualifiedLeads,
            period: 'monthly',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'on_track'
        },
        {
            id: '2',
            name: 'Negócios Fechados',
            description: 'Fechar contratos com restaurantes',
            type: 'conversions',
            target: 50,
            current: stats.closedDeals,
            period: 'monthly',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'at_risk'
        },
        {
            id: '3',
            name: 'Receita Mensal',
            description: 'Meta de faturamento do mês',
            type: 'revenue',
            target: 100000,
            current: 45000,
            period: 'monthly',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'behind'
        },
        {
            id: '4',
            name: 'Ligações Realizadas',
            description: 'Contatos telefônicos com prospects',
            type: 'calls',
            target: 200,
            current: 156,
            period: 'weekly',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'on_track'
        }
    ]);

    const [filter, setFilter] = useState<'all' | 'on_track' | 'at_risk' | 'behind' | 'completed' | 'active' | 'paused'>('all');
    const [showNewModal, setShowNewModal] = useState(false);
    const [newGoal, setNewGoal] = useState({
        name: '',
        description: '',
        type: 'leads' as const,
        target: 0,
        period: 'monthly' as const
    });

    const filteredGoals = filter === 'all'
        ? goals
        : goals.filter(g => g.status === filter);

    const getProgress = (goal: Goal) => {
        return Math.min(Math.round((goal.current / goal.target) * 100), 100);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return '#10b981';
            case 'on_track': return '#3b82f6';
            case 'at_risk': return '#f59e0b';
            case 'behind': return '#ef4444';
            case 'active': return '#3b82f6';
            case 'paused': return '#6b7280';
            default: return '#6b7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return '✅ Concluída';
            case 'on_track': return '🟢 No Caminho';
            case 'at_risk': return '🟡 Em Risco';
            case 'behind': return '🔴 Atrasada';
            case 'active': return '🔵 Ativa';
            case 'paused': return '⏸️ Pausada';
            default: return 'Desconhecido';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'leads': return '👥';
            case 'clients': return '👥';
            case 'revenue': return '💰';
            case 'conversions': return '🎯';
            case 'conversion': return '🎯';
            case 'calls': return '📞';
            case 'meetings': return '🤝';
            default: return '📊';
        }
    };

    const getPeriodLabel = (period: string) => {
        switch (period) {
            case 'daily': return 'Diária';
            case 'weekly': return 'Semanal';
            case 'monthly': return 'Mensal';
            case 'quarterly': return 'Trimestral';
            case 'yearly': return 'Anual';
            default: return period;
        }
    };

    const formatNumber = (num: number, type: string) => {
        if (type === 'revenue') {
            return `R$ ${num.toLocaleString('pt-BR')}`;
        }
        return num.toLocaleString('pt-BR');
    };

    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    };

    // Summary stats
    const summary = {
        total: goals.length,
        completed: goals.filter(g => g.status === 'completed').length,
        onTrack: goals.filter(g => g.status === 'on_track').length,
        atRisk: goals.filter(g => g.status === 'at_risk').length,
        behind: goals.filter(g => g.status === 'behind').length,
        avgProgress: goals.length > 0
            ? Math.round(goals.reduce((sum, g) => sum + getProgress(g), 0) / goals.length)
            : 0
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div>
                    <h1>🎯 Metas & Objetivos</h1>
                    <p>Acompanhe o progresso das suas metas de vendas</p>
                </div>
                <button
                    className={styles.newButton}
                    onClick={() => setShowNewModal(true)}
                >
                    + Nova Meta
                </button>
            </header>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryIcon}>📊</div>
                    <div className={styles.summaryContent}>
                        <span className={styles.summaryValue}>{summary.avgProgress}%</span>
                        <span className={styles.summaryLabel}>Progresso Médio</span>
                    </div>
                    <div className={styles.summaryProgress}>
                        <div
                            className={styles.summaryBar}
                            style={{ width: `${summary.avgProgress}%` }}
                        />
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryIcon}>✅</div>
                    <div className={styles.summaryContent}>
                        <span className={styles.summaryValue}>{summary.completed}/{summary.total}</span>
                        <span className={styles.summaryLabel}>Metas Concluídas</span>
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryIcon}>🎯</div>
                    <div className={styles.summaryContent}>
                        <span className={styles.summaryValue}>{stats.qualifiedLeads}</span>
                        <span className={styles.summaryLabel}>Leads Qualificados</span>
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryIcon}>💰</div>
                    <div className={styles.summaryContent}>
                        <span className={styles.summaryValue}>{stats.conversionRate}%</span>
                        <span className={styles.summaryLabel}>Taxa de Conversão</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className={styles.quickStats}>
                <div className={styles.quickStat}>
                    <span className={styles.quickDot} style={{ background: '#10b981' }}></span>
                    <span>{summary.completed} Concluídas</span>
                </div>
                <div className={styles.quickStat}>
                    <span className={styles.quickDot} style={{ background: '#3b82f6' }}></span>
                    <span>{summary.onTrack} No Caminho</span>
                </div>
                <div className={styles.quickStat}>
                    <span className={styles.quickDot} style={{ background: '#f59e0b' }}></span>
                    <span>{summary.atRisk} Em Risco</span>
                </div>
                <div className={styles.quickStat}>
                    <span className={styles.quickDot} style={{ background: '#ef4444' }}></span>
                    <span>{summary.behind} Atrasadas</span>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className={styles.filterTabs}>
                {[
                    { value: 'all', label: 'Todas' },
                    { value: 'on_track', label: '🟢 No Caminho' },
                    { value: 'at_risk', label: '🟡 Em Risco' },
                    { value: 'behind', label: '🔴 Atrasadas' },
                    { value: 'completed', label: '✅ Concluídas' },
                    { value: 'active', label: '🔵 Ativas' },
                    { value: 'paused', label: '⏸️ Pausadas' }
                ].map(tab => (
                    <button
                        key={tab.value}
                        className={`${styles.filterTab} ${filter === tab.value ? styles.active : ''}`}
                        onClick={() => setFilter(tab.value as any)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Goals Grid */}
            <div className={styles.goalsGrid}>
                {filteredGoals.map(goal => (
                    <div
                        key={goal.id}
                        className={styles.goalCard}
                        style={{ borderTopColor: getStatusColor(goal.status) }}
                    >
                        <div className={styles.goalHeader}>
                            <div className={styles.goalType}>
                                <span className={styles.typeIcon}>{getTypeIcon(goal.type)}</span>
                                <span className={styles.periodBadge}>{getPeriodLabel(goal.period)}</span>
                            </div>
                            <span
                                className={styles.statusBadge}
                                style={{ background: `${getStatusColor(goal.status)}20`, color: getStatusColor(goal.status) }}
                            >
                                {getStatusLabel(goal.status)}
                            </span>
                        </div>

                        <h3 className={styles.goalTitle}>{goal.name}</h3>
                        {goal.description && (
                            <p className={styles.goalDescription}>{goal.description}</p>
                        )}

                        <div className={styles.progressSection}>
                            <div className={styles.progressHeader}>
                                <span className={styles.progressText}>
                                    {formatNumber(goal.current, goal.type)} / {formatNumber(goal.target, goal.type)}
                                </span>
                                <span className={styles.progressPercent}>{getProgress(goal)}%</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{
                                        width: `${getProgress(goal)}%`,
                                        background: `linear-gradient(90deg, ${getStatusColor(goal.status)}, ${getStatusColor(goal.status)}88)`
                                    }}
                                />
                            </div>
                        </div>

                        <div className={styles.goalFooter}>
                            <div className={styles.daysRemaining}>
                                <span className={styles.daysIcon}>⏱️</span>
                                <span>{getDaysRemaining(goal.endDate)} dias restantes</span>
                            </div>
                            <div className={styles.goalActions}>
                                <button className={styles.editButton}>✏️</button>
                                <button className={styles.deleteButton}>🗑️</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredGoals.length === 0 && (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🎯</span>
                    <h3>Nenhuma meta encontrada</h3>
                    <p>Crie uma nova meta para começar a acompanhar seu progresso</p>
                    <button
                        className={styles.emptyButton}
                        onClick={() => setShowNewModal(true)}
                    >
                        + Criar Meta
                    </button>
                </div>
            )}

            {/* New Goal Modal */}
            {showNewModal && (
                <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeModal} onClick={() => setShowNewModal(false)}>✕</button>

                        <h2>🎯 Nova Meta</h2>

                        <div className={styles.formGroup}>
                            <label>Título</label>
                            <input
                                type="text"
                                value={newGoal.name}
                                onChange={(e) => setNewGoal(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Ex: Leads Qualificados do Mês"
                                className={styles.formInput}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Descrição (opcional)</label>
                            <textarea
                                value={newGoal.description}
                                onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Descreva sua meta..."
                                className={styles.formTextarea}
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Tipo</label>
                                <select
                                    value={newGoal.type}
                                    onChange={(e) => setNewGoal(prev => ({ ...prev, type: e.target.value as any }))}
                                    className={styles.formSelect}
                                >
                                    <option value="leads">👥 Leads</option>
                                    <option value="clients">👥 Clientes</option>
                                    <option value="revenue">💰 Receita</option>
                                    <option value="conversions">🎯 Conversões</option>
                                    <option value="calls">📞 Ligações</option>
                                    <option value="meetings">🤝 Reuniões</option>
                                    <option value="custom">📊 Personalizado</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Período</label>
                                <select
                                    value={newGoal.period}
                                    onChange={(e) => setNewGoal(prev => ({ ...prev, period: e.target.value as any }))}
                                    className={styles.formSelect}
                                >
                                    <option value="daily">Diária</option>
                                    <option value="weekly">Semanal</option>
                                    <option value="monthly">Mensal</option>
                                    <option value="quarterly">Trimestral</option>
                                    <option value="yearly">Anual</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Meta (valor alvo)</label>
                            <input
                                type="number"
                                value={newGoal.target || ''}
                                onChange={(e) => setNewGoal(prev => ({ ...prev, target: parseInt(e.target.value) || 0 }))}
                                placeholder="Ex: 100"
                                className={styles.formInput}
                            />
                        </div>

                        <div className={styles.formActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => setShowNewModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className={styles.saveButton}
                                disabled={!newGoal.name || !newGoal.target}
                            >
                                ✓ Criar Meta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
