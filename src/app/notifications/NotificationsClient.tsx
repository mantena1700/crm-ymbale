'use client';

import { useState } from 'react';
import { markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } from './actions';
import styles from './page.module.css';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

interface Props {
    initialNotifications: Notification[];
}

function getTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes} min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days === 1) return 'Ontem';
    return `${days} dias atrás`;
}

export default function NotificationsClient({ initialNotifications }: Props) {
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [loading, setLoading] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    const filteredNotifications = filter === 'unread' 
        ? notifications.filter(n => !n.read)
        : notifications;

    const handleMarkAsRead = async (id: string) => {
        const result = await markAsRead(id);
        if (result.success) {
            setNotifications(prev => 
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
        }
    };

    const handleMarkAllAsRead = async () => {
        setLoading(true);
        const result = await markAllAsRead();
        if (result.success) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const result = await deleteNotification(id);
        if (result.success) {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Tem certeza que deseja limpar todas as notificações?')) return;
        setLoading(true);
        const result = await clearAllNotifications();
        if (result.success) {
            setNotifications([]);
        }
        setLoading(false);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            case 'lead': return '🎯';
            case 'analysis': return '🤖';
            case 'followup': return '📅';
            case 'goal': return '🎯';
            default: return 'ℹ️';
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>🔔 Notificações</h1>
                    <p>Acompanhe as atualizações do sistema</p>
                </div>
                <div className={styles.headerStats}>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{notifications.length}</span>
                        <span className={styles.statLabel}>Total</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={`${styles.statValue} ${styles.unreadValue}`}>{unreadCount}</span>
                        <span className={styles.statLabel}>Não lidas</span>
                    </div>
                </div>
            </header>

            <div className={styles.toolbar}>
                <div className={styles.filters}>
                    <button 
                        className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        Todas ({notifications.length})
                    </button>
                    <button 
                        className={`${styles.filterBtn} ${filter === 'unread' ? styles.active : ''}`}
                        onClick={() => setFilter('unread')}
                    >
                        Não lidas ({unreadCount})
                    </button>
                </div>
                <div className={styles.actions}>
                    <button 
                        className={styles.actionBtn}
                        onClick={handleMarkAllAsRead}
                        disabled={loading || unreadCount === 0}
                    >
                        ✓ Marcar todas como lidas
                    </button>
                    <button 
                        className={`${styles.actionBtn} ${styles.danger}`}
                        onClick={handleClearAll}
                        disabled={loading || notifications.length === 0}
                    >
                        🗑️ Limpar todas
                    </button>
                </div>
            </div>

            <div className={styles.list}>
                {filteredNotifications.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>🔔</div>
                        <h3>Nenhuma notificação</h3>
                        <p>Você está em dia! Novas notificações aparecerão aqui.</p>
                    </div>
                ) : (
                    filteredNotifications.map(n => (
                        <div 
                            key={n.id} 
                            className={`${styles.notification} ${!n.read ? styles.unread : ''}`}
                            onClick={() => !n.read && handleMarkAsRead(n.id)}
                        >
                            <div className={`${styles.icon} ${styles[n.type]}`}>
                                {getIcon(n.type)}
                            </div>
                            <div className={styles.content}>
                                <h4>{n.title}</h4>
                                <p>{n.message}</p>
                                <span className={styles.time}>{getTimeAgo(n.createdAt)}</span>
                            </div>
                            <div className={styles.notificationActions}>
                                {!n.read && <span className={styles.dot}></span>}
                                <button 
                                    className={styles.deleteBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(n.id);
                                    }}
                                    title="Excluir"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

