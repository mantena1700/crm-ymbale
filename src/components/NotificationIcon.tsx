'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './NotificationIcon.module.css';

export function NotificationIcon() {
    const [notifications, setNotifications] = useState(0);

    useEffect(() => {
        const fetchCounts = () => {
            fetch('/api/sidebar-counts')
                .then(res => res.json())
                .then(data => {
                    setNotifications(data.notifications || 0);
                })
                .catch(() => {});
        };
        
        fetchCounts();
        const interval = setInterval(fetchCounts, 60000); // Update every 60 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <Link 
            href="/notifications"
            className={styles.notificationIcon}
            title={`Notificações${notifications > 0 ? ` (${notifications} não lidas)` : ''}`}
        >
            <span className={styles.notificationBell}>🔔</span>
            {notifications > 0 && (
                <span className={styles.notificationBadge}>{notifications}</span>
            )}
        </Link>
    );
}
