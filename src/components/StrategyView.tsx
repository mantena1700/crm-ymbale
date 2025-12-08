'use client';

import { useState } from 'react';
import styles from './StrategyView.module.css';

interface StrategyViewProps {
    strategy?: string;
}

export default function StrategyView({ strategy }: StrategyViewProps) {
    const [followUpDate, setFollowUpDate] = useState('');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        // In a real app, this would call a server action to save the date
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    if (!strategy) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>🎯 Estratégia de Venda (IA)</h3>
            </div>

            <div className={styles.content}>
                <p className={styles.strategyText}>{strategy}</p>
            </div>

            <div className={styles.actions}>
                <div className={styles.dateInput}>
                    <label>Agendar Follow-up:</label>
                    <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className={styles.input}
                    />
                </div>
                <button
                    className={styles.saveButton}
                    onClick={handleSave}
                    disabled={!followUpDate}
                >
                    {saved ? 'Agendado!' : 'Agendar Retorno'}
                </button>
            </div>
        </div>
    );
}
