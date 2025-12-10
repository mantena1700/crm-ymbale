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

interface AgendaClientProps {
    initialFollowUps: FollowUp[];
    restaurants: Restaurant[];
}

export default function AgendaClient({ initialFollowUps, restaurants }: AgendaClientProps) {
    const [followUps, setFollowUps] = useState(initialFollowUps);
    const [view, setView] = useState<'calendar' | 'list' | 'kanban'>('list');
    const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'call' | 'email' | 'meeting'>('all');
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

    // Filter follow-ups
    const filteredFollowUps = useMemo(() => {
        let result = followUps;

        if (!showCompleted) {
            result = result.filter(f => !f.completed);
        }

        if (typeFilter !== 'all') {
            result = result.filter(f => f.type === typeFilter);
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
    }, [followUps, filter, typeFilter, showCompleted, today, weekEnd]);

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

    const toggleComplete = (id: string) => {
        setFollowUps(prev => prev.map(f =>
            f.id === id ? { ...f, completed: !f.completed } : f
        ));
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
                        <span className={styles.statLabel}>Pendentes</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statToday}`}>
                    <span className={styles.statIcon}>🎯</span>
                    <div>
                        <span className={styles.statValue}>{stats.today}</span>
                        <span className={styles.statLabel}>Hoje</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statOverdue}`}>
                    <span className={styles.statIcon}>⚠️</span>
                    <div>
                        <span className={styles.statValue}>{stats.overdue}</span>
                        <span className={styles.statLabel}>Atrasados</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statCompleted}`}>
                    <span className={styles.statIcon}>✅</span>
                    <div>
                        <span className={styles.statValue}>{stats.completed}</span>
                        <span className={styles.statLabel}>Concluídos</span>
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

                <div className={styles.filters}>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className={styles.filterSelect}
                    >
                        <option value="all">Todos</option>
                        <option value="today">Hoje</option>
                        <option value="week">Esta Semana</option>
                        <option value="overdue">Atrasados</option>
                    </select>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                        className={styles.filterSelect}
                    >
                        <option value="all">Todos os Tipos</option>
                        <option value="call">📞 Ligações</option>
                        <option value="email">📧 Emails</option>
                        <option value="meeting">🤝 Reuniões</option>
                    </select>

                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={showCompleted}
                            onChange={(e) => setShowCompleted(e.target.checked)}
                        />
                        Mostrar concluídos
                    </label>
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
                                        <span className={styles.dateCount}>{items.length} item(s)</span>
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
                                                        >
                                                            👁️
                                                        </Link>
                                                    )}
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

