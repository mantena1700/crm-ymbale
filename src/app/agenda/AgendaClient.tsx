'use client';

import { useState, useMemo } from 'react';
import { Restaurant } from '@/lib/types';
import Link from 'next/link';
import styles from './page.module.css';

interface FollowUp {
    id: string;
    restaurantId: string;
    type: 'call' | 'email' | 'meeting';
    scheduledDate: string;
    notes?: string;
    completed: boolean;
    restaurant?: Restaurant;
}

interface Seller {
    id: string;
    name: string;
}

interface AgendaClientProps {
    initialFollowUps: FollowUp[];
    restaurants: Restaurant[];
    availableSellers?: Seller[];
}

import { completeFollowUp, deleteFollowUp } from '@/app/actions';

export default function AgendaClient({ initialFollowUps, restaurants, availableSellers = [] }: AgendaClientProps) {
    const [followUps, setFollowUps] = useState(initialFollowUps);
    const [view, setView] = useState<'calendar' | 'list' | 'kanban'>('list');
    const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'call' | 'email' | 'meeting'>('all');
    const [sellerFilter, setSellerFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [potentialFilter, setPotentialFilter] = useState<string>('all');
    const [cityFilter, setCityFilter] = useState<string>('all');
    const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('all');
    const [showCompleted, setShowCompleted] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showNewModal, setShowNewModal] = useState(false);
    const [newFollowUp, setNewFollowUp] = useState<{
        restaurantId: string;
        type: 'call' | 'email' | 'meeting';
        scheduledDate: string;
        notes: string;
    }>({
        restaurantId: '',
        type: 'call',
        scheduledDate: '',
        notes: ''
    });

    // Get current date info
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Extract unique values for filters
    const sellersOptions = useMemo(() => {
        const uniqueSellers = new Set<string>();
        let hasWithoutSeller = false;
        followUps.forEach(f => {
            if (f.restaurant?.seller?.name) {
                uniqueSellers.add(f.restaurant.seller.name);
            } else {
                hasWithoutSeller = true;
            }
        });
        const options = ['all', ...Array.from(uniqueSellers).sort()];
        if (hasWithoutSeller) {
            options.push('sem-executivo');
        }
        return options;
    }, [followUps]);

    const cities = useMemo(() => {
        const unique = new Set(
            followUps
                .map(f => f.restaurant?.address?.city)
                .filter(c => c && c !== 'undefined')
        );
        return ['all', ...Array.from(unique).sort()];
    }, [followUps]);

    const neighborhoods = useMemo(() => {
        const unique = new Set(
            followUps
                .map(f => f.restaurant?.address?.neighborhood)
                .filter(n => n && n !== 'undefined' && n.trim() !== '')
        );
        return ['all', ...Array.from(unique).sort()];
    }, [followUps]);

    // Filter follow-ups
    const filteredFollowUps = useMemo(() => {
        let result = followUps;

        if (!showCompleted) {
            result = result.filter(f => !f.completed);
        }

        if (typeFilter !== 'all') {
            result = result.filter(f => f.type === typeFilter);
        }

        // Filtro por executivo
        if (sellerFilter !== 'all') {
            if (sellerFilter === 'sem-executivo') {
                result = result.filter(f => !f.restaurant?.seller?.name);
            } else {
                result = result.filter(f => f.restaurant?.seller?.name === sellerFilter);
            }
        }

        // Filtro por status do restaurante
        if (statusFilter !== 'all') {
            result = result.filter(f => (f.restaurant?.status || 'A Analisar') === statusFilter);
        }

        // Filtro por potencial
        if (potentialFilter !== 'all') {
            result = result.filter(f => f.restaurant?.salesPotential === potentialFilter);
        }

        // Filtro por cidade
        if (cityFilter !== 'all') {
            result = result.filter(f => f.restaurant?.address?.city === cityFilter);
        }

        // Filtro por bairro
        if (neighborhoodFilter !== 'all') {
            result = result.filter(f => f.restaurant?.address?.neighborhood === neighborhoodFilter);
        }

        if (filter === 'today') {
            result = result.filter(f => {
                const date = new Date(f.scheduledDate);
                date.setHours(0, 0, 0, 0);
                return date.getTime() === today.getTime();
            });
        } else if (filter === 'week') {
            result = result.filter(f => {
                const date = new Date(f.scheduledDate);
                return date >= today && date <= weekEnd;
            });
        } else if (filter === 'overdue') {
            result = result.filter(f => {
                const date = new Date(f.scheduledDate);
                return date < today && !f.completed;
            });
        }

        return result.sort((a, b) =>
            new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
        );
    }, [followUps, filter, typeFilter, sellerFilter, statusFilter, potentialFilter, cityFilter, neighborhoodFilter, showCompleted, today, weekEnd]);

    // Group by date for list view
    const groupedByDate = useMemo(() => {
        const groups: Record<string, FollowUp[]> = {};

        filteredFollowUps.forEach(f => {
            const dateKey = new Date(f.scheduledDate).toLocaleDateString('pt-BR');
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(f);
        });

        return groups;
    }, [filteredFollowUps]);

    // Calendar data
    const calendarDays = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();

        const days: { date: Date; followUps: FollowUp[]; isCurrentMonth: boolean }[] = [];

        // Previous month padding
        for (let i = startPadding - 1; i >= 0; i--) {
            const date = new Date(year, month, -i);
            days.push({
                date,
                followUps: filteredFollowUps.filter(f => {
                    const fDate = new Date(f.scheduledDate);
                    return fDate.toDateString() === date.toDateString();
                }),
                isCurrentMonth: false
            });
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const date = new Date(year, month, i);
            days.push({
                date,
                followUps: filteredFollowUps.filter(f => {
                    const fDate = new Date(f.scheduledDate);
                    return fDate.toDateString() === date.toDateString();
                }),
                isCurrentMonth: true
            });
        }

        // Next month padding
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const date = new Date(year, month + 1, i);
            days.push({
                date,
                followUps: filteredFollowUps.filter(f => {
                    const fDate = new Date(f.scheduledDate);
                    return fDate.toDateString() === date.toDateString();
                }),
                isCurrentMonth: false
            });
        }

        return days;
    }, [selectedDate, filteredFollowUps]);

    const toggleComplete = async (id: string) => {
        // Optimistic update
        setFollowUps(prev => prev.map(f =>
            f.id === id ? { ...f, completed: !f.completed } : f
        ));

        try {
            await completeFollowUp(id);
        } catch (error) {
            console.error('Failed to complete follow-up', error);
            // Revert on error
            setFollowUps(prev => prev.map(f =>
                f.id === id ? { ...f, completed: !f.completed } : f
            ));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este follow-up?')) return;

        // Optimistic update
        setFollowUps(prev => prev.filter(f => f.id !== id));

        try {
            await deleteFollowUp(id);
        } catch (error) {
            console.error('Failed to delete follow-up', error);
            // Reload page or handle error appropriately as we can't easily revert a filter without refetching
            window.location.reload();
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'call': return '📞';
            case 'email': return '📧';
            case 'meeting': return '🤝';
            default: return '📅';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'call': return 'Ligação';
            case 'email': return 'Email';
            case 'meeting': return 'Reunião';
            default: return 'Outro';
        }
    };

    const isOverdue = (date: string) => {
        return new Date(date) < today;
    };

    const isToday = (date: Date) => {
        return date.toDateString() === today.toDateString();
    };

    // Stats
    const stats = {
        total: followUps.filter(f => !f.completed).length,
        today: followUps.filter(f => {
            const date = new Date(f.scheduledDate);
            date.setHours(0, 0, 0, 0);
            return date.getTime() === today.getTime() && !f.completed;
        }).length,
        overdue: followUps.filter(f => new Date(f.scheduledDate) < today && !f.completed).length,
        completed: followUps.filter(f => f.completed).length
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div>
                    <h1>📅 Agenda & Follow-ups</h1>
                    <p>Gerencie seus compromissos e acompanhamentos</p>
                </div>
                <button
                    className={styles.newButton}
                    onClick={() => setShowNewModal(true)}
                >
                    + Novo Follow-up
                </button>
            </header>

            {/* Stats */}
            <div className={styles.stats}>
                <div className={`${styles.statCard} ${styles.statTotal}`}>
                    <span className={styles.statIcon}>📋</span>
                    <div>
                        <span className={styles.statValue}>{stats.total}</span>
                        <span className={styles.statLabel}>Follow-ups Pendentes</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statToday}`}>
                    <span className={styles.statIcon}>🎯</span>
                    <div>
                        <span className={styles.statValue}>{stats.today}</span>
                        <span className={styles.statLabel}>Follow-ups de Hoje</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statOverdue}`}>
                    <span className={styles.statIcon}>⚠️</span>
                    <div>
                        <span className={styles.statValue}>{stats.overdue}</span>
                        <span className={styles.statLabel}>Follow-ups Atrasados</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statCompleted}`}>
                    <span className={styles.statIcon}>✅</span>
                    <div>
                        <span className={styles.statValue}>{stats.completed}</span>
                        <span className={styles.statLabel}>Follow-ups Concluídos</span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.viewButton} ${view === 'list' ? styles.active : ''}`}
                        onClick={() => setView('list')}
                    >
                        📝 Lista
                    </button>
                    <button
                        className={`${styles.viewButton} ${view === 'calendar' ? styles.active : ''}`}
                        onClick={() => setView('calendar')}
                    >
                        📆 Calendário
                    </button>
                </div>

                <div className={styles.filtersContainer}>
                    <div className={styles.filtersSection}>
                        <label className={styles.filterSectionLabel}>📅 Período</label>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className={styles.filterSelect}
                            title="Filtre follow-ups por período"
                        >
                            <option value="all">Todos os Períodos</option>
                            <option value="today">Follow-ups de Hoje</option>
                            <option value="week">Follow-ups desta Semana</option>
                            <option value="overdue">Follow-ups Atrasados</option>
                        </select>
                    </div>

                    <div className={styles.filtersSection}>
                        <label className={styles.filterSectionLabel}>📋 Tipo</label>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className={styles.filterSelect}
                            title="Filtre por tipo de follow-up"
                        >
                            <option value="all">Todos os Tipos</option>
                            <option value="call">📞 Ligações</option>
                            <option value="email">📧 Emails</option>
                            <option value="meeting">🤝 Reuniões</option>
                        </select>
                    </div>

                    <div className={styles.filtersSection}>
                        <label className={styles.filterSectionLabel}>👔 Executivo</label>
                        <select
                            value={sellerFilter}
                            onChange={(e) => setSellerFilter(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre follow-ups por executivo responsável"
                        >
                            <option value="all">Todos os Executivos</option>
                            {sellersOptions.filter(s => s !== 'all' && s !== 'sem-executivo').map(seller => (
                                <option key={seller} value={seller}>{seller}</option>
                            ))}
                            {sellersOptions.includes('sem-executivo') && (
                                <option value="sem-executivo">Sem Executivo</option>
                            )}
                        </select>
                    </div>

                    <div className={styles.filtersSection}>
                        <label className={styles.filterSectionLabel}>📊 Status Cliente</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre follow-ups por status do cliente"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="A Analisar">A Analisar</option>
                            <option value="Qualificado">Qualificado</option>
                            <option value="Contatado">Contatado</option>
                            <option value="Negociação">Negociação</option>
                            <option value="Fechado">Fechado</option>
                        </select>
                    </div>

                    <div className={styles.filtersSection}>
                        <label className={styles.filterSectionLabel}>🔥 Potencial</label>
                        <select
                            value={potentialFilter}
                            onChange={(e) => setPotentialFilter(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre follow-ups por potencial de vendas"
                        >
                            <option value="all">Todos os Potenciais</option>
                            <option value="ALTÍSSIMO">🔥 Altíssimo</option>
                            <option value="ALTO">⬆️ Alto</option>
                            <option value="MÉDIO">➡️ Médio</option>
                            <option value="BAIXO">⬇️ Baixo</option>
                        </select>
                    </div>

                    <div className={styles.filtersSection}>
                        <label className={styles.filterSectionLabel}>🏙️ Cidade</label>
                        <select
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre follow-ups por cidade do cliente"
                        >
                            <option value="all">Todas as Cidades</option>
                            {cities.filter(c => c !== 'all').map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filtersSection}>
                        <label className={styles.filterSectionLabel}>📍 Bairro</label>
                        <select
                            value={neighborhoodFilter}
                            onChange={(e) => setNeighborhoodFilter(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre follow-ups por bairro do cliente"
                        >
                            <option value="all">Todos os Bairros</option>
                            {neighborhoods.filter(n => n !== 'all').map(neighborhood => (
                                <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filtersSection}>
                        <label className={styles.checkboxLabel} title="Mostrar ou ocultar follow-ups já concluídos">
                            <input
                                type="checkbox"
                                checked={showCompleted}
                                onChange={(e) => setShowCompleted(e.target.checked)}
                            />
                            <span>Mostrar concluídos</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {view === 'list' && (
                    <div className={styles.listView}>
                        {Object.keys(groupedByDate).length === 0 ? (
                            <div className={styles.emptyState}>
                                <span className={styles.emptyIcon}>📅</span>
                                <h3>Nenhum follow-up encontrado</h3>
                                <p>Crie um novo follow-up para começar</p>
                                <button
                                    className={styles.emptyButton}
                                    onClick={() => setShowNewModal(true)}
                                >
                                    + Criar Follow-up
                                </button>
                            </div>
                        ) : (
                            Object.entries(groupedByDate).map(([date, items]) => (
                                <div key={date} className={styles.dateGroup}>
                                    <div className={styles.dateHeader}>
                                        <span className={styles.dateText}>{date}</span>
                                        <span className={styles.dateCount}>{items.length} follow-up(s)</span>
                                    </div>
                                    <div className={styles.dateItems}>
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className={`${styles.followUpCard} ${item.completed ? styles.completed : ''} ${isOverdue(item.scheduledDate) && !item.completed ? styles.overdue : ''}`}
                                            >
                                                <button
                                                    className={styles.checkButton}
                                                    onClick={() => toggleComplete(item.id)}
                                                >
                                                    {item.completed ? '✓' : ''}
                                                </button>

                                                <div className={styles.cardContent}>
                                                    <div className={styles.cardHeader}>
                                                        <span className={styles.typeTag}>
                                                            {getTypeIcon(item.type)} {getTypeLabel(item.type)}
                                                        </span>
                                                        <span className={styles.time}>
                                                            {new Date(item.scheduledDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>

                                                    {item.restaurant && (
                                                        <Link
                                                            href={`/restaurant/${item.restaurant.id}`}
                                                            className={styles.restaurantLink}
                                                        >
                                                            <strong>{item.restaurant.name}</strong>
                                                            <span>{item.restaurant.address?.city}</span>
                                                            {item.restaurant.seller && (
                                                                <span style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem', display: 'block' }}>
                                                                    👤 {item.restaurant.seller.name}
                                                                </span>
                                                            )}
                                                        </Link>
                                                    )}

                                                    {item.notes && (
                                                        <p className={styles.notes}>{item.notes}</p>
                                                    )}
                                                </div>

                                                <div className={styles.cardActions}>
                                                    {item.restaurant && (
                                                        <Link
                                                            href={`/restaurant/${item.restaurant.id}`}
                                                            className={styles.actionButton}
                                                            title="Ver Restaurante"
                                                        >
                                                            👁️
                                                        </Link>
                                                    )}
                                                    <button
                                                        className={styles.actionButton}
                                                        onClick={() => handleDelete(item.id)}
                                                        title="Excluir"
                                                        style={{ color: '#ef4444' }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {view === 'calendar' && (
                    <div className={styles.calendarView}>
                        <div className={styles.calendarHeader}>
                            <button
                                className={styles.calendarNav}
                                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                            >
                                ←
                            </button>
                            <h3>
                                {selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button
                                className={styles.calendarNav}
                                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                            >
                                →
                            </button>
                        </div>

                        <div className={styles.calendarGrid}>
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className={styles.calendarDayHeader}>{day}</div>
                            ))}

                            {calendarDays.map((day, i) => (
                                <div
                                    key={i}
                                    className={`
                                        ${styles.calendarDay} 
                                        ${!day.isCurrentMonth ? styles.otherMonth : ''}
                                        ${isToday(day.date) ? styles.today : ''}
                                    `}
                                >
                                    <span className={styles.dayNumber}>{day.date.getDate()}</span>
                                    {day.followUps.length > 0 && (
                                        <div className={styles.dayEvents}>
                                            {day.followUps.slice(0, 2).map(f => (
                                                <div
                                                    key={f.id}
                                                    className={`${styles.dayEvent} ${f.completed ? styles.completed : ''}`}
                                                    title={f.restaurant?.name}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent bubbling if needed
                                                    }}
                                                >
                                                    {getTypeIcon(f.type)}
                                                </div>
                                            ))}
                                            {day.followUps.length > 2 && (
                                                <span className={styles.moreEvents}>+{day.followUps.length - 2}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* New Follow-up Modal */}
            {showNewModal && (
                <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeModal} onClick={() => setShowNewModal(false)}>✕</button>

                        <h2>📅 Novo Follow-up</h2>

                        <div className={styles.formGroup}>
                            <label>Restaurante</label>
                            <select
                                value={newFollowUp.restaurantId}
                                onChange={(e) => setNewFollowUp(prev => ({ ...prev, restaurantId: e.target.value }))}
                                className={styles.formSelect}
                            >
                                <option value="">Selecione...</option>
                                {restaurants.slice(0, 100).map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                            {newFollowUp.restaurantId && (
                                (() => {
                                    const selectedRestaurant = restaurants.find(r => r.id === newFollowUp.restaurantId);
                                    if (selectedRestaurant?.seller) {
                                        return (
                                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#ecfdf5', borderRadius: '6px', fontSize: '0.875rem', color: '#065f46' }}>
                                                👤 Responsável: <strong>{selectedRestaurant.seller.name}</strong>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label>Tipo</label>
                            <div className={styles.typeButtons}>
                                {(['call', 'email', 'meeting'] as const).map(type => (
                                    <button
                                        key={type}
                                        className={`${styles.typeButton} ${newFollowUp.type === type ? styles.active : ''}`}
                                        onClick={() => setNewFollowUp(prev => ({ ...prev, type }))}
                                    >
                                        {getTypeIcon(type)} {getTypeLabel(type)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Data e Hora</label>
                            <input
                                type="datetime-local"
                                value={newFollowUp.scheduledDate}
                                onChange={(e) => setNewFollowUp(prev => ({ ...prev, scheduledDate: e.target.value }))}
                                className={styles.formInput}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Notas</label>
                            <textarea
                                value={newFollowUp.notes}
                                onChange={(e) => setNewFollowUp(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Observações sobre o follow-up..."
                                className={styles.formTextarea}
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
                                disabled={!newFollowUp.restaurantId || !newFollowUp.scheduledDate}
                            >
                                ✓ Criar Follow-up
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

