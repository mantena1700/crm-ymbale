'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { saveWeeklySchedule, getWeeklySchedule, getFixedClientsForWeek, deleteMultipleScheduleSlots } from './actions';
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
    time: string; // Mantido para compatibilidade, mas não será usado para horário
    date: string;
    visitIndex?: number; // Índice da visita (1-8)
    distanceFromFixed?: number; // Distância do cliente fixo em km
    durationMinutes?: number; // Tempo estimado em minutos (da Google Maps API)
}

interface WeeklyCalendarProps {
    restaurants: Restaurant[];
    sellerId: string;
    weekStart: Date;
    onAutoFill?: (schedule: any[]) => void;
}

// 8 visitas por dia (sem horários específicos)
// Usar índices de 1 a 8 para identificar as visitas
const VISIT_SLOTS = Array.from({ length: 8 }, (_, i) => i + 1);

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
    const [fixedClientsByDay, setFixedClientsByDay] = useState<{ [date: string]: Array<{
        id: string;
        restaurantId: string;
        restaurantName: string;
        restaurantAddress: any;
        radiusKm: number;
    }> }>({});
    
    // Novos estados para filtros e visualização
    const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('compact');
    const [potentialFilter, setPotentialFilter] = useState<PotentialFilter>('all');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
    const [hideEmptySlots, setHideEmptySlots] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // IDs dos slots selecionados
    const [restaurantSearch, setRestaurantSearch] = useState(''); // Busca de restaurantes

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
            
            // Carregar clientes fixos da semana (com tratamento de erro)
            try {
                const fixedClients = await getFixedClientsForWeek(sellerId, weekStart.toISOString());
                setFixedClientsByDay(fixedClients || {});
            } catch (error) {
                console.warn('Erro ao carregar clientes fixos (tabela pode não existir ainda):', error);
                setFixedClientsByDay({});
            }
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

    // Verificar se um slot é cliente fixo
    const isFixedClientSlot = useCallback((date: string, visitIndex: number) => {
        const fixedClients = fixedClientsByDay[date] || [];
        // Clientes fixos ocupam os primeiros slots do dia
        return fixedClients.length > 0 && visitIndex <= fixedClients.length;
    }, [fixedClientsByDay]);

    // Obter cliente fixo em um slot
    const getFixedClientInSlot = useCallback((date: string, visitIndex: number) => {
        const fixedClients = fixedClientsByDay[date] || [];
        if (fixedClients.length > 0 && visitIndex <= fixedClients.length) {
            return fixedClients[visitIndex - 1];
        }
        return null;
    }, [fixedClientsByDay]);

    // Verificar se um slot está ocupado (por data e índice de visita)
    const isSlotOccupied = (date: string, visitIndex: number) => {
        // Verificar se é cliente fixo primeiro
        if (isFixedClientSlot(date, visitIndex)) return true;
        
        return scheduledSlots.some(slot => {
            if (slot.date !== date) return false;
            // Compatibilidade: verificar por visitIndex ou por time convertido
            return slot.visitIndex === visitIndex || parseInt(slot.time || '0') === visitIndex;
        });
    };

    // Obter restaurante em um slot (por data e índice de visita)
    const getSlotRestaurant = (date: string, visitIndex: number) => {
        // Verificar se é cliente fixo primeiro
        const fixedClient = getFixedClientInSlot(date, visitIndex);
        if (fixedClient) {
            return {
                id: `fixed-${fixedClient.id}`, // ID especial para clientes fixos (não selecionáveis)
                restaurantId: fixedClient.restaurantId,
                restaurantName: fixedClient.restaurantName,
                isFixedClient: true
            };
        }
        
        return scheduledSlots.find(slot => {
            if (slot.date !== date) return false;
            // Compatibilidade: verificar por visitIndex ou por time convertido
            return slot.visitIndex === visitIndex || parseInt(slot.time || '0') === visitIndex;
        });
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

    // Handle drop (agora usa visitIndex ao invés de time)
    const handleDrop = async (e: React.DragEvent, date: string, visitIndex: number) => {
        e.preventDefault();
        
        if (!draggedRestaurant) return;

        // Verificar se o slot já está ocupado
        if (isSlotOccupied(date, visitIndex)) {
            alert('Esta visita já está ocupada!');
            return;
        }

        // Remover de outros slots se já estiver agendado
        const newSlots = scheduledSlots.filter(
            slot => !(slot.restaurantId === draggedRestaurant.id)
        );

        // Adicionar ao novo slot (usar visitIndex como time para compatibilidade)
        const newSlot: ScheduledSlot = {
            id: `${date}-${visitIndex}-${draggedRestaurant.id}`,
            restaurantId: draggedRestaurant.id,
            restaurantName: draggedRestaurant.name,
            time: String(visitIndex), // Usar índice como string para compatibilidade
            date,
            visitIndex
        };

        newSlots.push(newSlot);
        setScheduledSlots(newSlots);

        // Salvar no banco (usar hora padrão 12:00 para evitar problemas de timezone)
        setLoading(true);
        try {
            await saveWeeklySchedule(sellerId, date, '12:00', draggedRestaurant.id);
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

    // Remover agendamento (agora usa visitIndex)
    const handleRemoveSlot = async (date: string, visitIndex: number) => {
        // Não permitir remover clientes fixos
        if (isFixedClientSlot(date, visitIndex)) {
            alert('Este slot é reservado para um cliente fixo e não pode ser removido!');
            return;
        }

        if (!confirm('Deseja remover este agendamento?')) return;

        const newSlots = scheduledSlots.filter(slot => {
            if (slot.date !== date) return true;
            // Remover se for o mesmo visitIndex
            return !(slot.visitIndex === visitIndex || parseInt(slot.time || '0') === visitIndex);
        });
        setScheduledSlots(newSlots);

        setLoading(true);
        try {
            // Buscar o slot para obter o restaurante e remover
            const slotToRemove = scheduledSlots.find(slot => {
                if (slot.date !== date) return false;
                return slot.visitIndex === visitIndex || parseInt(slot.time || '0') === visitIndex;
            });
            if (slotToRemove) {
                await saveWeeklySchedule(sellerId, date, '12:00', null);
            }
        } catch (error) {
            console.error('Erro ao remover agendamento:', error);
            setScheduledSlots(scheduledSlots);
        } finally {
            setLoading(false);
        }
    };

    // Toggle seleção de slot
    const toggleSlotSelection = (slotId: string, isFixed: boolean) => {
        if (isFixed || slotId.startsWith('fixed-')) return; // Não permitir selecionar clientes fixos
        
        setSelectedSlots(prev => {
            const newSet = new Set(prev);
            if (newSet.has(slotId)) {
                newSet.delete(slotId);
            } else {
                newSet.add(slotId);
            }
            return newSet;
        });
    };

    // Selecionar todos os slots (exceto fixos)
    const handleSelectAll = () => {
        const selectableSlots = scheduledSlots.filter(slot => {
            const isFixed = isFixedClientSlot(slot.date, slot.visitIndex || parseInt(slot.time || '0'));
            return !isFixed;
        });
        setSelectedSlots(new Set(selectableSlots.map(s => s.id)));
    };

    // Limpar seleção
    const handleClearSelection = () => {
        setSelectedSlots(new Set());
    };

    // Remover slots selecionados
    const handleRemoveSelected = async () => {
        if (selectedSlots.size === 0) {
            alert('Nenhum agendamento selecionado');
            return;
        }

        if (!confirm(`Deseja remover ${selectedSlots.size} agendamento(s) selecionado(s)?`)) return;

        setLoading(true);
        try {
            const result = await deleteMultipleScheduleSlots(Array.from(selectedSlots));
            if (result.success) {
                await loadSchedule();
                setSelectedSlots(new Set());
                alert(`✅ ${result.deleted} agendamento(s) removido(s) com sucesso!`);
            } else {
                alert(`❌ Erro: ${result.error}`);
            }
        } catch (error) {
            console.error('Erro ao remover agendamentos:', error);
            alert('❌ Erro ao remover agendamentos');
        } finally {
            setLoading(false);
        }
    };

    // Slots de visita (8 por dia, sem horários)
    const visitSlots = useMemo(() => {
        return VISIT_SLOTS;
    }, []);

    // Restaurantes disponíveis (não agendados) e filtrados
    const availableRestaurants = useMemo(() => {
        const scheduledIds = scheduledSlots.map(s => s.restaurantId);
        let filtered = restaurants.filter(r => !scheduledIds.includes(r.id));
        
        // Filtrar por potencial
        if (potentialFilter !== 'all') {
            filtered = filtered.filter(r => normalizePotential(r.salesPotential) === potentialFilter);
        }
        
        // Filtrar por busca
        if (restaurantSearch.trim()) {
            const search = restaurantSearch.toLowerCase().trim();
            filtered = filtered.filter(r => 
                r.name.toLowerCase().includes(search) ||
                r.address?.neighborhood?.toLowerCase().includes(search) ||
                r.address?.city?.toLowerCase().includes(search)
            );
        }
        
        return filtered;
    }, [restaurants, scheduledSlots, potentialFilter, restaurantSearch]);

    // Verificar se um slot deve ser mostrado (filtro de vazios)
    const shouldShowSlot = (date: string, visitIndex: number) => {
        if (!hideEmptySlots) return true;
        return isSlotOccupied(date, visitIndex);
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
                                title="Visualização em cards"
                            >
                                ▦
                            </button>
                            <button
                                className={`${styles.viewToggleBtn} ${restaurantsViewMode === 'list' ? styles.active : ''}`}
                                onClick={() => setRestaurantsViewMode('list')}
                                title="Visualização em lista"
                            >
                                ☰
                            </button>
                        </div>
                    )}
                </div>
                {!sidebarCollapsed && (
                    <div className={styles.restaurantSearch}>
                        <input
                            type="text"
                            placeholder="🔍 Buscar restaurante, bairro ou cidade..."
                            value={restaurantSearch}
                            onChange={(e) => setRestaurantSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                )}
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
                                    title={`${restaurant.name}\n📍 ${restaurant.address?.neighborhood || 'N/D'}, ${restaurant.address?.city || ''}\n⭐ ${restaurant.rating?.toFixed(1) || 'N/D'} | ${restaurant.status || 'A Analisar'}\n${priority.label} - Arraste para agendar`}
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
                                    {restaurant.status && (
                                        <div className={styles.restaurantStatus}>
                                            <span className={styles.statusIndicator} style={{
                                                background: restaurant.status === 'Fechado' ? '#22c55e' :
                                                            restaurant.status === 'Negociação' ? '#8b5cf6' :
                                                            restaurant.status === 'Contatado' ? '#3b82f6' :
                                                            restaurant.status === 'Qualificado' ? '#10b981' : '#6366f1'
                                            }}>
                                                {restaurant.status}
                                            </span>
                                        </div>
                                    )}
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
                                    <th>Status</th>
                                    <th>Avaliação</th>
                                    <th>Potencial</th>
                                </tr>
                            </thead>
                            <tbody>
                                {availableRestaurants.map(restaurant => {
                                    const priority = getPriorityBadge(restaurant.salesPotential);
                                    const statusColors: Record<string, string> = {
                                        'Fechado': '#22c55e',
                                        'Negociação': '#8b5cf6',
                                        'Contatado': '#3b82f6',
                                        'Qualificado': '#10b981',
                                        'A Analisar': '#6366f1'
                                    };
                                    const statusColor = statusColors[restaurant.status || 'A Analisar'] || '#6366f1';
                                    
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
                                            <td>
                                                <span 
                                                    className={styles.statusBadge} 
                                                    style={{
                                                        background: statusColor,
                                                        color: 'white',
                                                        padding: '5px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        display: 'inline-block',
                                                        boxShadow: `0 3px 10px ${statusColor}60`,
                                                        border: `1px solid ${statusColor}80`
                                                    }}
                                                    title={`Status: ${restaurant.status || 'A Analisar'}`}
                                                >
                                                    {restaurant.status || 'A Analisar'}
                                                </span>
                                            </td>
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
                {/* Barra de Controle de Seleção */}
                {selectedSlots.size > 0 && (
                    <div className={styles.selectionBar}>
                        <div className={styles.selectionInfo}>
                            <span>📋 {selectedSlots.size} agendamento(s) selecionado(s)</span>
                        </div>
                        <div className={styles.selectionActions}>
                            <button
                                className={styles.clearSelectionBtn}
                                onClick={handleClearSelection}
                            >
                                Limpar Seleção
                            </button>
                            <button
                                className={styles.removeSelectedBtn}
                                onClick={handleRemoveSelected}
                                disabled={loading}
                            >
                                🗑️ Remover Selecionados ({selectedSlots.size})
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Botões de Seleção Rápida */}
                <div className={styles.quickSelectionBar}>
                    <button
                        className={styles.selectAllBtn}
                        onClick={handleSelectAll}
                        disabled={scheduledSlots.filter(s => !isFixedClientSlot(s.date, s.visitIndex || parseInt(s.time || '0'))).length === 0}
                    >
                        ☑️ Selecionar Tudo
                    </button>
                    {selectedSlots.size > 0 && (
                        <button
                            className={styles.clearSelectionBtn}
                            onClick={handleClearSelection}
                        >
                            Limpar Seleção
                        </button>
                    )}
                </div>

                <div className={styles.calendarHeader}>
                    <div className={styles.timeColumn}>
                        <div className={styles.timeHeader}>Visita</div>
                        {visitSlots.map(visitIndex => (
                            <div key={visitIndex} className={styles.timeSlot}>
                                {visitIndex}
                            </div>
                        ))}
                    </div>

                    {weekDays.map(day => (
                        <div key={day.date} className={styles.dayColumn}>
                            <div className={`${styles.dayHeader} ${day.isToday ? styles.today : ''}`}>
                                <span className={styles.dayName}>{day.dayName}</span>
                                <span className={styles.dayNum}>{day.dayNum}</span>
                                <span className={styles.dayMonth}>{day.month}</span>
                                {(() => {
                                    const daySlots = visitSlots.filter(vi => {
                                        const slot = getSlotRestaurant(day.date, vi);
                                        return !!slot;
                                    });
                                    const progress = daySlots.length;
                                    const maxSlots = 8;
                                    const progressPercent = (progress / maxSlots) * 100;
                                    return (
                                        <div className={styles.dayProgress}>
                                            <div className={styles.progressBar}>
                                                <div 
                                                    className={styles.progressFill} 
                                                    style={{ 
                                                        width: `${progressPercent}%`,
                                                        background: progress === maxSlots 
                                                            ? 'linear-gradient(90deg, #10b981, #059669)' 
                                                            : progress >= maxSlots / 2 
                                                                ? 'linear-gradient(90deg, #f59e0b, #d97706)' 
                                                                : 'linear-gradient(90deg, #ef4444, #dc2626)'
                                                    }}
                                                />
                                            </div>
                                            <span className={styles.progressText}>
                                                {progress}/{maxSlots}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>
                            {visitSlots.map(visitIndex => {
                                if (!shouldShowSlot(day.date, visitIndex)) return null;
                                const slot = getSlotRestaurant(day.date, visitIndex);
                                const isOccupied = !!slot;
                                const isFixed = isFixedClientSlot(day.date, visitIndex);
                                
                                const isSelected = slot && selectedSlots.has(slot.id);
                                
                                return (
                                    <div
                                        key={`${day.date}-${visitIndex}`}
                                        className={`${styles.calendarSlot} ${isOccupied ? styles.occupied : styles.empty} ${isFixed ? styles.fixedClient : ''} ${isSelected ? styles.selected : ''}`}
                                        onDragOver={isFixed ? undefined : handleDragOver}
                                        onDrop={isFixed ? undefined : (e) => handleDrop(e, day.date, visitIndex)}
                                        onClick={() => {
                                            if (isOccupied && !isFixed && slot) {
                                                toggleSlotSelection(slot.id, isFixed);
                                            }
                                        }}
                                        title={
                                            isFixed 
                                                ? `📌 Cliente Fixo\n${slot.restaurantName}\nNão pode ser removido` 
                                                : isOccupied 
                                                    ? `${slot.restaurantName}\n📍 ${getRestaurantById(slot.restaurantId)?.address?.neighborhood || 'N/D'}\n⭐ ${getRestaurantById(slot.restaurantId)?.rating?.toFixed(1) || 'N/D'}\n${isSelected ? '✓ Selecionado - Clique para desmarcar' : 'Clique para selecionar'}`
                                                    : 'Arraste um restaurante aqui para agendar'
                                        }
                                    >
                                        {isOccupied && slot ? (
                                            <div className={`${styles.slotContent} ${isFixed ? styles.fixedClientContent : ''} ${isSelected ? styles.selectedContent : ''}`}>
                                                {/* Checkbox de seleção */}
                                                {!isFixed && (
                                                    <input
                                                        type="checkbox"
                                                        className={styles.slotCheckbox}
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            toggleSlotSelection(slot.id, isFixed);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={isSelected ? 'Desmarcar' : 'Selecionar'}
                                                    />
                                                )}
                                                {isFixed && <span className={styles.fixedClientBadge}>📌</span>}
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
                                                                        handleRemoveSlot(day.date, visitIndex);
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
                                                                    {(slot as any).distanceFromFixed !== undefined && (
                                                                        <span className={styles.compactDistance}>
                                                                            📍 {(slot as any).distanceFromFixed.toFixed(1)}km
                                                                            {(slot as any).durationMinutes && (
                                                                                <> | ⏱️ {(slot as any).durationMinutes}min</>
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        className={styles.removeBtnCompact}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveSlot(day.date, visitIndex);
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
                                                                    handleRemoveSlot(day.date, visitIndex);
                                                                }}
                                                                title="Remover"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        {(slot as any).distanceFromFixed !== undefined && (
                                                            <div className={styles.distanceInfo}>
                                                                📍 {(slot as any).distanceFromFixed.toFixed(1)}km do cliente fixo
                                                                {(slot as any).durationMinutes ? (
                                                                    <span className={styles.estimatedTime}>
                                                                        ⏱️ {(slot as any).durationMinutes}min (Google Maps)
                                                                    </span>
                                                                ) : (
                                                                    <span className={styles.estimatedTime}>
                                                                        ⏱️ ~{Math.round((slot as any).distanceFromFixed * 3)} min (estimado)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
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
                                                <span className={styles.plusIcon}>+</span>
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

