'use client';

import { useState } from 'react';
import styles from './QuickViewModal.module.css';

interface Restaurant {
    id: string;
    name: string;
    rating: number;
    reviewCount: number;
    address: any;
    status: string;
    salesPotential: string | null;
    projectedDeliveries: number;
    commentsCount?: number;
    sellerName?: string | null;
}

interface Props {
    restaurant: Restaurant;
    onClose: () => void;
    onUpdateStatus?: (id: string, status: string) => Promise<void>;
    onUpdatePriority?: (id: string, priority: string) => Promise<void>;
    onScheduleVisit?: (id: string) => void;
    onAddNote?: (id: string, note: string) => Promise<void>;
}

export default function QuickViewModal({ 
    restaurant, 
    onClose, 
    onUpdateStatus,
    onUpdatePriority,
    onScheduleVisit,
    onAddNote 
}: Props) {
    const [activeTab, setActiveTab] = useState<'info' | 'actions' | 'notes'>('info');
    const [loading, setLoading] = useState(false);
    const [newNote, setNewNote] = useState('');

    const getPriorityBadge = (potential: string | null) => {
        switch (potential) {
            case 'ALTISSIMO': return { label: '🔥 Altíssimo', class: styles.priorityAltissimo };
            case 'ALTO': return { label: '⬆️ Alto', class: styles.priorityAlto };
            case 'MEDIO': return { label: '➡️ Médio', class: styles.priorityMedio };
            case 'BAIXO': return { label: '⬇️ Baixo', class: styles.priorityBaixo };
            default: return { label: '❓ N/D', class: styles.priorityNd };
        }
    };

    const getStatusClass = (status: string) => {
        const statusMap: Record<string, string> = {
            'A Analisar': styles.statusAnalisar,
            'Qualificado': styles.statusQualificado,
            'Contatado': styles.statusContatado,
            'Negociação': styles.statusNegociacao,
            'Fechado': styles.statusFechado
        };
        return statusMap[status] || styles.statusAnalisar;
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!onUpdateStatus) return;
        setLoading(true);
        await onUpdateStatus(restaurant.id, newStatus);
        setLoading(false);
    };

    const handlePriorityChange = async (newPriority: string) => {
        if (!onUpdatePriority) return;
        setLoading(true);
        await onUpdatePriority(restaurant.id, newPriority);
        setLoading(false);
    };

    const handleAddNote = async () => {
        if (!onAddNote || !newNote.trim()) return;
        setLoading(true);
        await onAddNote(restaurant.id, newNote);
        setNewNote('');
        setLoading(false);
    };

    const priority = getPriorityBadge(restaurant.salesPotential);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerInfo}>
                        <h2>{restaurant.name}</h2>
                        <span className={styles.location}>
                            📍 {restaurant.address?.neighborhood || 'N/D'}, {restaurant.address?.city || ''}
                        </span>
                        {restaurant.sellerName && (
                            <span className={styles.seller}>👤 {restaurant.sellerName}</span>
                        )}
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.tabs}>
                    <button 
                        className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        📋 Info
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'actions' ? styles.active : ''}`}
                        onClick={() => setActiveTab('actions')}
                    >
                        ⚡ Ações
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'notes' ? styles.active : ''}`}
                        onClick={() => setActiveTab('notes')}
                    >
                        📝 Notas
                    </button>
                </div>

                <div className={styles.content}>
                    {activeTab === 'info' && (
                        <div className={styles.infoTab}>
                            <div className={styles.statsGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statIcon}>⭐</span>
                                    <div>
                                        <strong>{(restaurant.rating != null && !isNaN(Number(restaurant.rating))) ? Number(restaurant.rating).toFixed(1) : 'N/D'}</strong>
                                        <span>Avaliação</span>
                                    </div>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statIcon}>💬</span>
                                    <div>
                                        <strong>{restaurant.commentsCount || (restaurant.reviewCount != null ? Number(restaurant.reviewCount) : 0)}</strong>
                                        <span>Comentários</span>
                                    </div>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statIcon}>📦</span>
                                    <div>
                                        <strong>{restaurant.projectedDeliveries != null ? Number(restaurant.projectedDeliveries).toLocaleString('pt-BR') : '0'}</strong>
                                        <span>Entregas/mês</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.badges}>
                                <div className={styles.badgeItem}>
                                    <label>Status:</label>
                                    <span className={`${styles.statusBadge} ${getStatusClass(restaurant.status || 'A Analisar')}`}>
                                        {restaurant.status || 'A Analisar'}
                                    </span>
                                </div>
                                <div className={styles.badgeItem}>
                                    <label>Potencial:</label>
                                    <span className={`${styles.priorityBadge} ${priority.class}`}>
                                        {priority.label}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.address}>
                                <h4>📍 Endereço</h4>
                                <p>{restaurant.address?.street || ''} {restaurant.address?.number ? `, ${restaurant.address.number}` : ''}</p>
                                <p>{restaurant.address?.neighborhood || ''} - {restaurant.address?.city || ''}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div className={styles.actionsTab}>
                            {onScheduleVisit && (
                                <button 
                                    className={styles.actionBtn}
                                    onClick={() => {
                                        onClose();
                                        onScheduleVisit(restaurant.id);
                                    }}
                                >
                                    <span>📅</span>
                                    <div>
                                        <strong>Agendar Visita</strong>
                                        <span>Marcar uma visita presencial</span>
                                    </div>
                                </button>
                            )}
                            
                            <a href={`/restaurant/${restaurant.id}`} className={styles.actionBtn}>
                                <span>🔗</span>
                                <div>
                                    <strong>Ver Página Completa</strong>
                                    <span>Todos os detalhes e análise IA</span>
                                </div>
                            </a>

                            {onUpdateStatus && (
                                <div className={styles.quickStatus}>
                                    <h4>⚡ Alterar Status</h4>
                                    <div className={styles.statusBtns}>
                                        {['A Analisar', 'Qualificado', 'Contatado', 'Negociação', 'Fechado'].map(status => (
                                            <button
                                                key={status}
                                                className={`${styles.statusBtn} ${restaurant.status === status ? styles.active : ''}`}
                                                onClick={() => handleStatusChange(status)}
                                                disabled={loading}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {onUpdatePriority && (
                                <div className={styles.quickPriority}>
                                    <h4>🎯 Alterar Prioridade</h4>
                                    <div className={styles.priorityBtns}>
                                        {[
                                            { value: 'ALTISSIMO', label: '🔥 Altíssimo' },
                                            { value: 'ALTO', label: '⬆️ Alto' },
                                            { value: 'MEDIO', label: '➡️ Médio' },
                                            { value: 'BAIXO', label: '⬇️ Baixo' }
                                        ].map(p => (
                                            <button
                                                key={p.value}
                                                className={`${styles.priorityBtn} ${restaurant.salesPotential === p.value ? styles.active : ''}`}
                                                onClick={() => handlePriorityChange(p.value)}
                                                disabled={loading}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className={styles.notesTab}>
                            {onAddNote && (
                                <div className={styles.addNote}>
                                    <textarea
                                        value={newNote}
                                        onChange={e => setNewNote(e.target.value)}
                                        placeholder="Digite uma nota rápida..."
                                        rows={3}
                                    />
                                    <button 
                                        onClick={handleAddNote}
                                        disabled={!newNote.trim() || loading}
                                    >
                                        {loading ? 'Salvando...' : '💾 Salvar'}
                                    </button>
                                </div>
                            )}
                            <p className={styles.noteHint}>
                                💡 Para ver todas as notas e histórico, acesse a página completa
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

