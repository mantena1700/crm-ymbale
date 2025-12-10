'use client';

import { useState, useMemo, useCallback } from 'react';
import { Restaurant, AnalysisResult } from '@/lib/types';
import { updateRestaurantStatus, performAnalysis } from '@/app/actions';
import { createFollowUp, bulkUpdateStatus, getRestaurantQuickView, EnrichedRestaurant, PipelineMetrics } from './actions';
import Link from 'next/link';
import styles from './page.module.css';
import QuickViewModal from '@/components/QuickViewModal';

interface PipelineClientProps {
    initialRestaurants: EnrichedRestaurant[];
    initialMetrics: PipelineMetrics;
}

type PipelineStage = 'A Analisar' | 'Qualificado' | 'Contatado' | 'Negociação' | 'Fechado' | 'Descartado';

const STAGES: { id: PipelineStage; label: string; icon: string; color: string }[] = [
    { id: 'A Analisar', label: 'A Analisar', icon: '🔍', color: '#6366f1' },
    { id: 'Qualificado', label: 'Qualificado', icon: '✅', color: '#10b981' },
    { id: 'Contatado', label: 'Contatado', icon: '📞', color: '#f59e0b' },
    { id: 'Negociação', label: 'Negociação', icon: '🤝', color: '#8b5cf6' },
    { id: 'Fechado', label: 'Fechado', icon: '🎉', color: '#22c55e' },
];

export default function PipelineClient({ initialRestaurants, initialMetrics }: PipelineClientProps) {
    const [restaurants, setRestaurants] = useState(initialRestaurants);
    const [metrics, setMetrics] = useState(initialMetrics);
    const [filter, setFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'grid'>('kanban');
    const [sortBy, setSortBy] = useState<'name' | 'score' | 'potential' | 'rating'>('potential');
    const [quickViewId, setQuickViewId] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [showFollowUpModal, setShowFollowUpModal] = useState<string | null>(null);
    const [followUpForm, setFollowUpForm] = useState({ type: 'call' as const, date: '', notes: '' });

    // Filtered and sorted restaurants
    const filteredRestaurants = useMemo(() => {
        let result = restaurants;

        // Filter by priority
        if (filter !== 'all') {
            result = result.filter(r => r.priority === filter);
        }

        // Filter by search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.name.toLowerCase().includes(term) ||
                r.address?.city?.toLowerCase().includes(term) ||
                r.address?.neighborhood?.toLowerCase().includes(term)
            );
        }

        // Sort
        result = [...result].sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'score') return (b.analysis?.score || 0) - (a.analysis?.score || 0);
            if (sortBy === 'rating') return b.rating - a.rating;
            if (sortBy === 'potential') {
                const order = { 'ALTÍSSIMO': 4, 'ALTO': 3, 'MÉDIO': 2, 'BAIXO': 1 };
                return (order[b.salesPotential as keyof typeof order] || 0) - (order[a.salesPotential as keyof typeof order] || 0);
            }
            return 0;
        });

        return result;
    }, [restaurants, filter, searchTerm, sortBy]);

    // Group by stage for Kanban
    const restaurantsByStage = useMemo(() => {
        const grouped: Record<PipelineStage, EnrichedRestaurant[]> = {
            'A Analisar': [],
            'Qualificado': [],
            'Contatado': [],
            'Negociação': [],
            'Fechado': [],
            'Descartado': []
        };

        filteredRestaurants.forEach(r => {
            const stage = (r.status as PipelineStage) || 'A Analisar';
            if (grouped[stage]) {
                grouped[stage].push(r);
            }
        });

        return grouped;
    }, [filteredRestaurants]);

    // Handle drag and drop
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, newStatus: PipelineStage) => {
        e.preventDefault();
        if (!draggedId) return;

        // Optimistic update
        setRestaurants(prev => prev.map(r =>
            r.id === draggedId ? { ...r, status: newStatus } : r
        ));

        // Persist
        await updateRestaurantStatus(draggedId, newStatus);
        setDraggedId(null);
    };

    // Quick view restaurant
    const quickViewRestaurant = quickViewId ? restaurants.find(r => r.id === quickViewId) : null;
    
    // Open quick view modal
    const openQuickView = (id: string) => {
        setQuickViewId(id);
    };
    
    // Handlers para QuickViewModal
    const handleQuickUpdateStatus = async (id: string, status: string) => {
        setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        await updateRestaurantStatus(id, status);
    };
    
    const handleQuickUpdatePriority = async (id: string, priority: string) => {
        setRestaurants(prev => prev.map(r => r.id === id ? { ...r, salesPotential: priority } : r));
    };

    // Analyze with AI
    const handleAnalyze = async (restaurant: Restaurant) => {
        setAnalyzing(prev => new Set(prev).add(restaurant.id));
        try {
            const result = await performAnalysis(restaurant.id);
            setRestaurants(prev => prev.map(r =>
                r.id === restaurant.id ? { ...r, analysis: result } : r
            ));
        } catch (error) {
            console.error('Analysis error:', error);
        } finally {
            setAnalyzing(prev => {
                const next = new Set(prev);
                next.delete(restaurant.id);
                return next;
            });
        }
    };

    // Bulk actions
    const handleBulkAction = async (action: 'qualify' | 'contact' | 'discard') => {
        if (selectedIds.size === 0) return;

        const statusMap = {
            qualify: 'Qualificado',
            contact: 'Contatado',
            discard: 'Descartado'
        };

        await bulkUpdateStatus(Array.from(selectedIds), statusMap[action]);

        setRestaurants(prev => prev.map(r =>
            selectedIds.has(r.id) ? { ...r, status: statusMap[action] } : r
        ));
        setSelectedIds(new Set());
    };

    // Follow-up
    const handleCreateFollowUp = async () => {
        if (!showFollowUpModal || !followUpForm.date) return;

        await createFollowUp(
            showFollowUpModal,
            followUpForm.type,
            followUpForm.date,
            followUpForm.notes
        );

        setShowFollowUpModal(null);
        setFollowUpForm({ type: 'call', date: '', notes: '' });
    };

    // Toggle selection
    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Get priority badge
    const getPriorityBadge = (priority: string) => {
        const badges: Record<string, { label: string; class: string }> = {
            urgent: { label: '🔥 Urgente', class: styles.priorityUrgent },
            high: { label: '⚡ Alto', class: styles.priorityHigh },
            medium: { label: '📊 Médio', class: styles.priorityMedium },
            low: { label: '💤 Baixo', class: styles.priorityLow }
        };
        return badges[priority] || badges.low;
    };

    // Render card
    const renderCard = (restaurant: EnrichedRestaurant, compact = false) => {
        const isSelected = selectedIds.has(restaurant.id);
        const isAnalyzing = analyzing.has(restaurant.id);
        const priority = getPriorityBadge(restaurant.priority);

        return (
            <div
                key={restaurant.id}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${compact ? styles.cardCompact : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, restaurant.id)}
                onClick={() => !compact && openQuickView(restaurant.id)}
            >
                <div className={styles.cardHeader}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            toggleSelection(restaurant.id);
                        }}
                        className={styles.checkbox}
                    />
                    <div className={styles.cardTitle}>
                        <h4>{restaurant.name}</h4>
                    </div>
                    <span className={`${styles.priorityBadge} ${priority.class}`}>
                        {priority.label}
                    </span>
                </div>

                <div className={styles.cardBody}>
                    <div className={styles.cardStats}>
                        <div className={styles.cardStat}>
                            <span className={styles.statIcon}>⭐</span>
                            <span>{(restaurant.rating != null && !isNaN(Number(restaurant.rating))) ? Number(restaurant.rating).toFixed(1) : '0.0'}</span>
                        </div>
                        <div className={styles.cardStat}>
                            <span className={styles.statIcon}>📦</span>
                            <span>{restaurant.projectedDeliveries != null && !isNaN(Number(restaurant.projectedDeliveries)) && Number(restaurant.projectedDeliveries) > 0 
                                ? ((Number(restaurant.projectedDeliveries) / 1000).toFixed(0) + 'K') 
                                : '0'}</span>
                        </div>
                        {restaurant.analysis?.score !== undefined && restaurant.analysis.score > 0 && (
                            <div className={styles.cardStat}>
                                <span className={styles.statIcon}>🎯</span>
                                <span className={styles.scoreValue}>{restaurant.analysis.score}</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.cardLocation}>
                        📍 {restaurant.address?.city || 'N/A'}, {restaurant.address?.state || ''}
                    </div>

                    {restaurant.analysis?.painPoints && restaurant.analysis.painPoints.length > 0 && (
                        <div className={styles.cardPainPoints}>
                            {restaurant.analysis.painPoints.slice(0, 2).map((p, i) => (
                                <span key={i} className={styles.painPointTag}>
                                    {p.length > 30 ? p.substring(0, 30) + '...' : p}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.cardActions}>
                    {!restaurant.analysis || restaurant.analysis.score === 0 ? (
                        <button
                            className={styles.analyzeButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAnalyze(restaurant);
                            }}
                            disabled={isAnalyzing}
                        >
                            {isAnalyzing ? '⏳ Analisando...' : '🤖 Analisar IA'}
                        </button>
                    ) : (
                        <button
                            className={styles.followUpButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowFollowUpModal(restaurant.id);
                            }}
                        >
                            📅 Follow-up
                        </button>
                    )}
                    <Link
                        href={`/restaurant/${restaurant.id}`}
                        className={styles.detailsButton}
                        onClick={(e) => e.stopPropagation()}
                    >
                        Ver Detalhes →
                    </Link>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1><span className={styles.emoji}>🚀</span> <span className={styles.titleText}>Pipeline de Vendas</span></h1>
                        <p>Gerencie seus leads com inteligência artificial</p>
                    </div>
                    <div className={styles.headerActions}>
                        <div className={styles.viewToggle}>
                            <button
                                className={`${styles.viewButton} ${viewMode === 'kanban' ? styles.active : ''}`}
                                onClick={() => setViewMode('kanban')}
                            >
                                📋 Kanban
                            </button>
                            <button
                                className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                                onClick={() => setViewMode('list')}
                            >
                                📝 Lista
                            </button>
                            <button
                                className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
                                onClick={() => setViewMode('grid')}
                            >
                                🔲 Grid
                            </button>
                        </div>
                    </div>
                </div>

                {/* Metrics */}
                <div className={styles.metricsBar}>
                    <div className={styles.metricCard}>
                        <span className={styles.metricIcon}>📊</span>
                        <div className={styles.metricContent}>
                            <span className={styles.metricValue}>{metrics.total.toLocaleString()}</span>
                            <span className={styles.metricLabel}>Total Leads</span>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <span className={styles.metricIcon}>🎯</span>
                        <div className={styles.metricContent}>
                            <span className={styles.metricValue}>{metrics.avgScore}</span>
                            <span className={styles.metricLabel}>Score Médio</span>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <span className={styles.metricIcon}>🔥</span>
                        <div className={styles.metricContent}>
                            <span className={styles.metricValue}>{metrics.highPriority}</span>
                            <span className={styles.metricLabel}>Alta Prioridade</span>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <span className={styles.metricIcon}>✅</span>
                        <div className={styles.metricContent}>
                            <span className={styles.metricValue}>{metrics.byStatus['Qualificado'] || 0}</span>
                            <span className={styles.metricLabel}>Qualificados</span>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <span className={styles.metricIcon}>🤝</span>
                        <div className={styles.metricContent}>
                            <span className={styles.metricValue}>{metrics.byStatus['Negociação'] || 0}</span>
                            <span className={styles.metricLabel}>Em Negociação</span>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <span className={styles.metricIcon}>🎉</span>
                        <div className={styles.metricContent}>
                            <span className={styles.metricValue}>{metrics.conversionRate}%</span>
                            <span className={styles.metricLabel}>Conversão</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, categoria ou cidade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                    {searchTerm && (
                        <button
                            className={styles.clearSearch}
                            onClick={() => setSearchTerm('')}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className={styles.filters}>
                    <button
                        className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        Todos ({filteredRestaurants.length})
                    </button>
                    <button
                        className={`${styles.filterButton} ${filter === 'urgent' ? styles.active : ''}`}
                        onClick={() => setFilter('urgent')}
                    >
                        🔥 Urgente
                    </button>
                    <button
                        className={`${styles.filterButton} ${filter === 'high' ? styles.active : ''}`}
                        onClick={() => setFilter('high')}
                    >
                        ⚡ Alto
                    </button>
                    <button
                        className={`${styles.filterButton} ${filter === 'medium' ? styles.active : ''}`}
                        onClick={() => setFilter('medium')}
                    >
                        📊 Médio
                    </button>
                </div>

                <div className={styles.sortBox}>
                    <label>Ordenar:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className={styles.sortSelect}
                    >
                        <option value="potential">Potencial</option>
                        <option value="score">Score IA</option>
                        <option value="rating">Avaliação</option>
                        <option value="name">Nome</option>
                    </select>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className={styles.bulkActions}>
                    <span className={styles.selectedCount}>
                        {selectedIds.size} selecionado(s)
                    </span>
                    <button
                        className={styles.bulkButton}
                        onClick={() => handleBulkAction('qualify')}
                    >
                        ✅ Qualificar
                    </button>
                    <button
                        className={styles.bulkButton}
                        onClick={() => handleBulkAction('contact')}
                    >
                        📞 Marcar Contatado
                    </button>
                    <button
                        className={`${styles.bulkButton} ${styles.bulkDiscard}`}
                        onClick={() => handleBulkAction('discard')}
                    >
                        ❌ Descartar
                    </button>
                    <button
                        className={styles.bulkClear}
                        onClick={() => setSelectedIds(new Set())}
                    >
                        Limpar seleção
                    </button>
                </div>
            )}

            {/* Content */}
            <div className={styles.content}>
                {viewMode === 'kanban' && (
                    <div className={styles.kanban}>
                        {STAGES.map(stage => (
                            <div
                                key={stage.id}
                                className={styles.column}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.id)}
                            >
                                <div
                                    className={styles.columnHeader}
                                    style={{ borderTopColor: stage.color }}
                                >
                                    <div className={styles.columnTitle}>
                                        <span>{stage.icon}</span>
                                        <h3>{stage.label}</h3>
                                    </div>
                                    <span className={styles.columnCount}>
                                        {restaurantsByStage[stage.id]?.length || 0}
                                    </span>
                                </div>
                                <div className={styles.columnContent}>
                                    {restaurantsByStage[stage.id]?.slice(0, 20).map(r => renderCard(r, true))}
                                    {(restaurantsByStage[stage.id]?.length || 0) > 20 && (
                                        <div className={styles.moreIndicator}>
                                            +{(restaurantsByStage[stage.id]?.length || 0) - 20} mais
                                        </div>
                                    )}
                                    {restaurantsByStage[stage.id]?.length === 0 && (
                                        <div className={styles.emptyColumn}>
                                            <span>Arraste cards aqui</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'list' && (
                    <div className={styles.listView}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds(new Set(filteredRestaurants.map(r => r.id)));
                                                } else {
                                                    setSelectedIds(new Set());
                                                }
                                            }}
                                        />
                                    </th>
                                    <th>Nome</th>
                                    <th>Categoria</th>
                                    <th>Cidade</th>
                                    <th>Potencial</th>
                                    <th>Status</th>
                                    <th>Score</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRestaurants.slice(0, 50).map(r => (
                                    <tr key={r.id} className={selectedIds.has(r.id) ? styles.rowSelected : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(r.id)}
                                                onChange={() => toggleSelection(r.id)}
                                            />
                                        </td>
                                        <td>
                                            <div className={styles.nameCell}>
                                                <strong>{r.name}</strong>
                                                <span>⭐ {r.rating}</span>
                                            </div>
                                        </td>
                                        <td>{r.address?.neighborhood || '-'}</td>
                                        <td>{r.address?.city || 'N/A'}</td>
                                        <td>
                                            <span className={`${styles.potentialBadge} ${styles[`potential${r.salesPotential?.replace(/Í/g, 'I')}`]}`}>
                                                {r.salesPotential}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={styles.statusBadge}>
                                                {r.status || 'A Analisar'}
                                            </span>
                                        </td>
                                        <td>
                                            {r.analysis?.score ? (
                                                <span className={styles.scoreBadge}>{r.analysis.score}</span>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <div className={styles.tableActions}>
                                                <button
                                                    onClick={() => openQuickView(r.id)}
                                                    className={styles.tableAction}
                                                >
                                                    👁️
                                                </button>
                                                <Link href={`/restaurant/${r.id}`} className={styles.tableAction}>
                                                    →
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredRestaurants.length > 50 && (
                            <div className={styles.tableFooter}>
                                Mostrando 50 de {filteredRestaurants.length} resultados
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'grid' && (
                    <div className={styles.gridView}>
                        {filteredRestaurants.slice(0, 30).map(r => renderCard(r))}
                        {filteredRestaurants.length > 30 && (
                            <div className={styles.gridMore}>
                                +{filteredRestaurants.length - 30} mais leads
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Quick View Modal */}
            {quickViewRestaurant && (
                <QuickViewModal
                    restaurant={{
                        id: quickViewRestaurant.id,
                        name: quickViewRestaurant.name,
                        rating: quickViewRestaurant.rating,
                        reviewCount: quickViewRestaurant.reviewCount ?? 0,
                        address: quickViewRestaurant.address,
                        status: quickViewRestaurant.status || 'A Analisar',
                        salesPotential: quickViewRestaurant.salesPotential,
                        projectedDeliveries: quickViewRestaurant.projectedDeliveries ?? 0,
                        commentsCount: quickViewRestaurant.totalComments ?? quickViewRestaurant.comments?.length ?? 0
                    }}
                    onClose={() => setQuickViewId(null)}
                    onUpdateStatus={handleQuickUpdateStatus}
                    onUpdatePriority={handleQuickUpdatePriority}
                    onScheduleVisit={(id) => {
                        setQuickViewId(null);
                        setShowFollowUpModal(id);
                    }}
                />
            )}

            {/* Follow-up Modal */}
            {showFollowUpModal && (
                <div className={styles.modalOverlay} onClick={() => setShowFollowUpModal(null)}>
                    <div className={styles.followUpModal} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeModal} onClick={() => setShowFollowUpModal(null)}>✕</button>

                        <h2>📅 Agendar Follow-up</h2>

                        <div className={styles.formGroup}>
                            <label>Tipo de Contato</label>
                            <div className={styles.typeButtons}>
                                {[
                                    { type: 'call', icon: '📞', label: 'Ligação' },
                                    { type: 'email', icon: '📧', label: 'Email' },
                                    { type: 'meeting', icon: '🤝', label: 'Reunião' },
                                ].map(t => (
                                    <button
                                        key={t.type}
                                        className={`${styles.typeButton} ${followUpForm.type === t.type ? styles.active : ''}`}
                                        onClick={() => setFollowUpForm(prev => ({ ...prev, type: t.type as any }))}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Data</label>
                            <input
                                type="datetime-local"
                                value={followUpForm.date}
                                onChange={(e) => setFollowUpForm(prev => ({ ...prev, date: e.target.value }))}
                                className={styles.dateInput}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Notas (opcional)</label>
                            <textarea
                                value={followUpForm.notes}
                                onChange={(e) => setFollowUpForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Observações sobre o follow-up..."
                                className={styles.notesInput}
                            />
                        </div>

                        <div className={styles.formActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => setShowFollowUpModal(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className={styles.saveButton}
                                onClick={handleCreateFollowUp}
                                disabled={!followUpForm.date}
                            >
                                ✓ Agendar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
