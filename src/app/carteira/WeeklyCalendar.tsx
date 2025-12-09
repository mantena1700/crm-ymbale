'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { saveWeeklySchedule, getWeeklySchedule } from './actions';
import styles from './WeeklyCalendar.module.css';

interface Restaurant {
    id: string;
    name: string;
    rating: number;
    address: any;
    salesPotential: string | null;
    status: string;
}

interface ScheduledSlot {
    id: string;
    restaurantId: string;
    restaurantName: string;
    time: string;
    date: string;
}

interface WeeklyCalendarProps {
    restaurants: Restaurant[];
    sellerId: string;
    weekStart: Date;
    onAutoFill?: (schedule: any[]) => void;
}

// Horários disponíveis: 8 prospecções das 08:00 às 18:00
const TIME_SLOTS = [
    '08:00', '09:15', '10:30', '11:45',
    '13:00', '14:15', '15:30', '16:45'
];

const MORNING_SLOTS = ['08:00', '09:15', '10:30', '11:45'];
const AFTERNOON_SLOTS = ['13:00', '14:15', '15:30', '16:45'];

// Função para normalizar salesPotential
const normalizePotential = (potential: string | null | undefined): string => {
    if (!potential) return 'BAIXO';
    return potential.toUpperCase().trim();
};

// Tipos de visualização do calendário
type CalendarViewMode = 'compact' | 'detailed' | 'minimal';
type PotentialFilter = 'all' | 'ALTISSIMO' | 'ALTO' | 'MEDIO' | 'BAIXO';
type PeriodFilter = 'all' | 'morning' | 'afternoon';

export default function WeeklyCalendar({ restaurants, sellerId, weekStart }: WeeklyCalendarProps) {
    const [scheduledSlots, setScheduledSlots] = useState<ScheduledSlot[]>([]);
    const [draggedRestaurant, setDraggedRestaurant] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
    const [restaurantsViewMode, setRestaurantsViewMode] = useState<'cards' | 'list'>('list');
    
    // Novos estados para filtros e visualização
    const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('compact');
    const [potentialFilter, setPotentialFilter] = useState<PotentialFilter>('all');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
    const [hideEmptySlots, setHideEmptySlots] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Gerar dias da semana
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            days.push({
                date: date.toISOString().split('T')[0],
                dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
                dayNum: date.getDate(),
                month: date.toLocaleDateString('pt-BR', { month: 'short' }),
                isToday: date.toDateString() === new Date().toDateString()
            });
        }
        return days;
    }, [weekStart]);

    // Carregar agendamentos salvos
    const loadSchedule = useCallback(async () => {
        setLoading(true);
        try {
            const schedule = await getWeeklySchedule(sellerId, weekStart.toISOString());
            setScheduledSlots(schedule);
        } catch (error) {
            console.error('Erro ao carregar agenda:', error);
        } finally {
            setLoading(false);
        }
    }, [sellerId, weekStart]);

    // Carregar ao montar componente
    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    // Verificar se um slot está ocupado
    const isSlotOccupied = (date: string, time: string) => {
        return scheduledSlots.some(slot => slot.date === date && slot.time === time);
    };

    // Obter restaurante em um slot
    const getSlotRestaurant = (date: string, time: string) => {
        return scheduledSlots.find(slot => slot.date === date && slot.time === time);
    };

    // Obter restaurante por ID
    const getRestaurantById = (id: string) => {
        return restaurants.find(r => r.id === id);
    };

    // Handle drag start
    const handleDragStart = (e: React.DragEvent, restaurant: Restaurant) => {
        setDraggedRestaurant(restaurant);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', restaurant.id);
    };

    // Handle drag over
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Handle drop
    const handleDrop = async (e: React.DragEvent, date: string, time: string) => {
        e.preventDefault();
        
        if (!draggedRestaurant) return;

        // Verificar se o slot já está ocupado
        if (isSlotOccupied(date, time)) {
            alert('Este horário já está ocupado!');
            return;
        }

        // Remover de outros slots se já estiver agendado
        const newSlots = scheduledSlots.filter(
            slot => !(slot.restaurantId === draggedRestaurant.id)
        );

        // Adicionar ao novo slot
        const newSlot: ScheduledSlot = {
            id: `${date}-${time}-${draggedRestaurant.id}`,
            restaurantId: draggedRestaurant.id,
            restaurantName: draggedRestaurant.name,
            time,
            date
        };

        newSlots.push(newSlot);
        setScheduledSlots(newSlots);

        // Salvar no banco
        setLoading(true);
        try {
            await saveWeeklySchedule(sellerId, date, time, draggedRestaurant.id);
        } catch (error) {
            console.error('Erro ao salvar agendamento:', error);
            alert('Erro ao salvar agendamento');
            // Reverter
            setScheduledSlots(scheduledSlots);
        } finally {
            setLoading(false);
        }

        setDraggedRestaurant(null);
    };

    // Remover agendamento
    const handleRemoveSlot = async (date: string, time: string) => {
        if (!confirm('Deseja remover este agendamento?')) return;

        const newSlots = scheduledSlots.filter(
            slot => !(slot.date === date && slot.time === time)
        );
        setScheduledSlots(newSlots);

        setLoading(true);
        try {
            await saveWeeklySchedule(sellerId, date, time, null);
        } catch (error) {
            console.error('Erro ao remover agendamento:', error);
            setScheduledSlots(scheduledSlots);
        } finally {
            setLoading(false);
        }
    };

    // Horários filtrados por período
    const filteredTimeSlots = useMemo(() => {
        if (periodFilter === 'morning') return MORNING_SLOTS;
        if (periodFilter === 'afternoon') return AFTERNOON_SLOTS;
        return TIME_SLOTS;
    }, [periodFilter]);

    // Restaurantes disponíveis (não agendados) e filtrados
    const availableRestaurants = useMemo(() => {
        const scheduledIds = scheduledSlots.map(s => s.restaurantId);
        let filtered = restaurants.filter(r => !scheduledIds.includes(r.id));
        
        // Filtrar por potencial
        if (potentialFilter !== 'all') {
            filtered = filtered.filter(r => normalizePotential(r.salesPotential) === potentialFilter);
        }
        
        return filtered;
    }, [restaurants, scheduledSlots, potentialFilter]);

    // Verificar se um slot deve ser mostrado (filtro de vazios)
    const shouldShowSlot = (date: string, time: string) => {
        if (!hideEmptySlots) return true;
        return isSlotOccupied(date, time);
    };

    // Obter badge de prioridade (normalizado)
    const getPriorityBadge = (potential: string | null) => {
        const normalized = normalizePotential(potential);
        switch (normalized) {
            case 'ALTISSIMO': return { label: '🔥', class: styles.priorityAltissimo, color: '#ef4444' };
            case 'ALTO': return { label: '⬆️', class: styles.priorityAlto, color: '#fbbf24' };
            case 'MEDIO': return { label: '➡️', class: styles.priorityMedio, color: '#3b82f6' };
            case 'BAIXO': return { label: '⬇️', class: styles.priorityBaixo, color: '#9ca3af' };
            default: return { label: '❓', class: styles.priorityNd, color: '#9ca3af' };
        }
    };

    return (
        <div className={styles.calendarContainer}>
            {/* Barra de Filtros */}
            <div className={styles.filtersBar}>
                <div className={styles.filterGroup}>
                    <label>Visualização:</label>
                    <select 
                        value={calendarViewMode} 
                        onChange={(e) => setCalendarViewMode(e.target.value as CalendarViewMode)}
                        className={styles.filterSelect}
                    >
                        <option value="compact">Compacto</option>
                        <option value="detailed">Detalhado</option>
                        <option value="minimal">Minimalista</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label>Potencial:</label>
                    <select 
                        value={potentialFilter} 
                        onChange={(e) => setPotentialFilter(e.target.value as PotentialFilter)}
                        className={styles.filterSelect}
                    >
                        <option value="all">Todos</option>
                        <option value="ALTISSIMO">🔥 Altíssimo</option>
                        <option value="ALTO">⬆️ Alto</option>
                        <option value="MEDIO">➡️ Médio</option>
                        <option value="BAIXO">⬇️ Baixo</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label>Período:</label>
                    <select 
                        value={periodFilter} 
                        onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                        className={styles.filterSelect}
                    >
                        <option value="all">Dia Todo</option>
                        <option value="morning">☀️ Manhã</option>
                        <option value="afternoon">🌙 Tarde</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.checkboxLabel}>
                        <input 
                            type="checkbox" 
                            checked={hideEmptySlots}
                            onChange={(e) => setHideEmptySlots(e.target.checked)}
                        />
                        Ocultar vazios
                    </label>
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div className={styles.mainContent}>
                {/* Lista de Restaurantes Disponíveis */}
                <div className={`${styles.availableRestaurants} ${sidebarCollapsed ? styles.collapsed : ''}`}>
                <div className={styles.restaurantsHeader}>
                    <button 
                        className={styles.collapseBtn}
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? 'Expandir' : 'Recolher'}
                    >
                        {sidebarCollapsed ? '▶' : '◀'}
                    </button>
                    {!sidebarCollapsed && (
                        <>
                            <h3>📋 Restaurantes</h3>
                            <span className={styles.countBadge}>{availableRestaurants.length}</span>
                        </>
                    )}
                    {!sidebarCollapsed && (
                        <div className={styles.viewToggle}>
                            <button
                                className={`${styles.viewToggleBtn} ${restaurantsViewMode === 'cards' ? styles.active : ''}`}
                                onClick={() => setRestaurantsViewMode('cards')}
                                title="Cards"
                            >
                                ▦
                            </button>
                            <button
                                className={`${styles.viewToggleBtn} ${restaurantsViewMode === 'list' ? styles.active : ''}`}
                                onClick={() => setRestaurantsViewMode('list')}
                                title="Lista"
                            >
                                ☰
                            </button>
                        </div>
                    )}
                </div>
                {sidebarCollapsed ? null : availableRestaurants.length === 0 ? (
                    <p className={styles.emptyMessage}>Todos os restaurantes estão agendados</p>
                ) : restaurantsViewMode === 'cards' ? (
                    <div className={styles.restaurantsList}>
                        {availableRestaurants.map(restaurant => {
                            const priority = getPriorityBadge(restaurant.salesPotential);
                            return (
                                <div
                                    key={restaurant.id}
                                    className={styles.restaurantCard}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, restaurant)}
                                >
                                    <div className={styles.restaurantHeader}>
                                        <span className={`${styles.priorityBadge} ${priority.class}`}>
                                            {priority.label}
                                        </span>
                                        <strong>{restaurant.name}</strong>
                                    </div>
                                    <div className={styles.restaurantInfo}>
                                        <span>📍 {restaurant.address?.neighborhood || 'N/D'}</span>
                                        <span>⭐ {restaurant.rating?.toFixed(1) || 'N/D'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className={styles.restaurantsTable}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Restaurante</th>
                                    <th>Bairro</th>
                                    <th>Avaliação</th>
                                    <th>Potencial</th>
                                </tr>
                            </thead>
                            <tbody>
                                {availableRestaurants.map(restaurant => {
                                    const priority = getPriorityBadge(restaurant.salesPotential);
                                    return (
                                        <tr
                                            key={restaurant.id}
                                            className={styles.restaurantRow}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, restaurant)}
                                        >
                                            <td>
                                                <div className={styles.tableRestaurantName}>
                                                    <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                        {priority.label}
                                                    </span>
                                                    <strong>{restaurant.name}</strong>
                                                </div>
                                            </td>
                                            <td>{restaurant.address?.neighborhood || 'N/D'}</td>
                                            <td>⭐ {restaurant.rating?.toFixed(1) || 'N/D'}</td>
                                            <td>
                                                <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                    {priority.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Calendário Semanal */}
            <div className={`${styles.calendar} ${styles[`view${calendarViewMode.charAt(0).toUpperCase() + calendarViewMode.slice(1)}`]}`}>
                <div className={styles.calendarHeader}>
                    <div className={styles.timeColumn}>
                        <div className={styles.timeHeader}>Horário</div>
                        {filteredTimeSlots.map(time => (
                            <div key={time} className={styles.timeSlot}>
                                {time}
                            </div>
                        ))}
                    </div>

                    {weekDays.map(day => (
                        <div key={day.date} className={styles.dayColumn}>
                            <div className={`${styles.dayHeader} ${day.isToday ? styles.today : ''}`}>
                                <span className={styles.dayName}>{day.dayName}</span>
                                <span className={styles.dayNum}>{day.dayNum}</span>
                                <span className={styles.dayMonth}>{day.month}</span>
                            </div>
                            {filteredTimeSlots.map(time => {
                                if (!shouldShowSlot(day.date, time)) return null;
                                const slot = getSlotRestaurant(day.date, time);
                                const isOccupied = !!slot;
                                
                                return (
                                    <div
                                        key={`${day.date}-${time}`}
                                        className={`${styles.calendarSlot} ${isOccupied ? styles.occupied : styles.empty}`}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, day.date, time)}
                                        onClick={() => {
                                            if (isOccupied) {
                                                setSelectedSlot({ date: day.date, time });
                                            }
                                        }}
                                    >
                                        {isOccupied && slot ? (
                                            <div className={styles.slotContent}>
                                                {calendarViewMode === 'minimal' ? (
                                                    // Modo minimalista: apenas indicador colorido
                                                    (() => {
                                                        const restaurant = getRestaurantById(slot.restaurantId);
                                                        const priority = getPriorityBadge(restaurant?.salesPotential || null);
                                                        return (
                                                            <div 
                                                                className={styles.minimalIndicator}
                                                                style={{ backgroundColor: priority.color }}
                                                                title={slot.restaurantName}
                                                            >
                                                                <button
                                                                    className={styles.removeBtnMini}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveSlot(day.date, time);
                                                                    }}
                                                                >✕</button>
                                                            </div>
                                                        );
                                                    })()
                                                ) : calendarViewMode === 'compact' ? (
                                                    // Modo compacto: nome abreviado + cor
                                                    (() => {
                                                        const restaurant = getRestaurantById(slot.restaurantId);
                                                        const priority = getPriorityBadge(restaurant?.salesPotential || null);
                                                        const shortName = slot.restaurantName.length > 15 
                                                            ? slot.restaurantName.substring(0, 15) + '...'
                                                            : slot.restaurantName;
                                                        return (
                                                            <>
                                                                <div className={styles.compactHeader} style={{ borderLeftColor: priority.color }}>
                                                                    <span className={styles.compactName} title={slot.restaurantName}>{shortName}</span>
                                                                    <button
                                                                        className={styles.removeBtnCompact}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveSlot(day.date, time);
                                                                        }}
                                                                    >✕</button>
                                                                </div>
                                                                <div className={styles.compactInfo}>
                                                                    <span className={styles.compactBadge}>{priority.label}</span>
                                                                    <span className={styles.compactNeighborhood}>📍 {restaurant?.address?.neighborhood || 'N/D'}</span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()
                                                ) : (
                                                    // Modo detalhado: todas as informações
                                                    <>
                                                        <div className={styles.slotHeader}>
                                                            <strong>{slot.restaurantName}</strong>
                                                            <button
                                                                className={styles.removeBtn}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveSlot(day.date, time);
                                                                }}
                                                                title="Remover"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        {(() => {
                                                            const restaurant = getRestaurantById(slot.restaurantId);
                                                            if (!restaurant) return null;
                                                            const priority = getPriorityBadge(restaurant.salesPotential);
                                                            return (
                                                                <div className={styles.slotInfo}>
                                                                    <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                                        {priority.label}
                                                                    </span>
                                                                    <span>📍 {restaurant.address?.neighborhood || 'N/D'}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={styles.emptySlot}>
                                                <span className={styles.dropHint}>{calendarViewMode === 'minimal' ? '+' : 'Arraste aqui'}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            </div> {/* Fim do mainContent */}

            {/* Modal de Detalhes do Slot */}
            {selectedSlot && (() => {
                const slot = getSlotRestaurant(selectedSlot.date, selectedSlot.time);
                if (!slot) return null;
                const restaurant = getRestaurantById(slot.restaurantId);
                if (!restaurant) return null;

                return (
                    <div className={styles.modalOverlay} onClick={() => setSelectedSlot(null)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>📅 Detalhes do Agendamento</h3>
                                <button className={styles.closeBtn} onClick={() => setSelectedSlot(null)}>✕</button>
                            </div>
                            <div className={styles.modalBody}>
                                <div className={styles.modalInfo}>
                                    <div className={styles.modalRow}>
                                        <strong>Restaurante:</strong>
                                        <span>{restaurant.name}</span>
                                    </div>
                                    <div className={styles.modalRow}>
                                        <strong>Data:</strong>
                                        <span>{new Date(selectedSlot.date).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <div className={styles.modalRow}>
                                        <strong>Horário:</strong>
                                        <span>{selectedSlot.time}</span>
                                    </div>
                                    <div className={styles.modalRow}>
                                        <strong>Bairro:</strong>
                                        <span>{restaurant.address?.neighborhood || 'N/D'}</span>
                                    </div>
                                    <div className={styles.modalRow}>
                                        <strong>Avaliação:</strong>
                                        <span>⭐ {restaurant.rating?.toFixed(1) || 'N/D'}</span>
                                    </div>
                                    <div className={styles.modalRow}>
                                        <strong>Status:</strong>
                                        <span>{restaurant.status}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button
                                    className={styles.removeBtn}
                                    onClick={() => {
                                        handleRemoveSlot(selectedSlot.date, selectedSlot.time);
                                        setSelectedSlot(null);
                                    }}
                                >
                                    🗑️ Remover Agendamento
                                </button>
                                <button
                                    className={styles.closeBtn}
                                    onClick={() => setSelectedSlot(null)}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {loading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingSpinner}>⏳ Salvando...</div>
                </div>
            )}
        </div>
    );
}

