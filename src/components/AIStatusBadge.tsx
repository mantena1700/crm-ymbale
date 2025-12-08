'use client';

import { useState, useEffect } from 'react';
import styles from './AIStatusBadge.module.css';

export default function AIStatusBadge() {
    const [status, setStatus] = useState<'checking' | 'active' | 'inactive'>('checking');

    useEffect(() => {
        // Check if OpenAI is configured
        fetch('/api/check-ai')
            .then(res => res.json())
            .then(data => {
                setStatus(data.active ? 'active' : 'inactive');
            })
            .catch(() => setStatus('inactive'));
    }, []);

    if (status === 'checking') {
        return (
            <div className={styles.badge}>
                <span className={styles.spinner}></span>
                Verificando IA...
            </div>
        );
    }

    return (
        <div className={`${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`}>
            {status === 'active' ? '🤖 IA Ativa' : '⚠️ IA Não Configurada'}
        </div>
    );
}

