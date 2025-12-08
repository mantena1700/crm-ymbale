'use client';

import { useState } from 'react';
import { createVisit } from '@/app/actions';
import styles from './VisitModal.module.css';

interface VisitModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    restaurantName: string;
    sellerId: string;
    sellerName: string;
    onVisitCreated: () => void;
}

export default function VisitModal({ isOpen, onClose, restaurantId, restaurantName, sellerId, sellerName, onVisitCreated }: VisitModalProps) {
    const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
    const [feedback, setFeedback] = useState('');
    const [outcome, setOutcome] = useState<'positive' | 'neutral' | 'negative' | 'scheduled'>('positive');
    const [nextVisitDate, setNextVisitDate] = useState('');
    const [createFollowUp, setCreateFollowUp] = useState(true);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await createVisit({
                restaurantId,
                sellerId,
                visitDate,
                feedback,
                outcome,
                nextVisitDate: nextVisitDate || undefined,
                createFollowUp
            });
            
            onVisitCreated();
            onClose();
            
            // Reset form
            setVisitDate(new Date().toISOString().split('T')[0]);
            setFeedback('');
            setOutcome('positive');
            setNextVisitDate('');
            setCreateFollowUp(true);
        } catch (error: any) {
            alert('Erro ao registrar visita: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>📅 Registrar Visita</h2>
                    <button onClick={onClose} className={styles.closeButton}>×</button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.infoBox}>
                        <p><strong>Restaurante:</strong> {restaurantName}</p>
                        <p><strong>Vendedor:</strong> {sellerName}</p>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Data da Visita *</label>
                        <input
                            type="date"
                            value={visitDate}
                            onChange={(e) => setVisitDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Resultado da Visita *</label>
                        <select
                            value={outcome}
                            onChange={(e) => setOutcome(e.target.value as any)}
                            required
                        >
                            <option value="positive">✅ Positivo - Interessado</option>
                            <option value="neutral">➖ Neutro - A considerar</option>
                            <option value="negative">❌ Negativo - Não interessado</option>
                            <option value="scheduled">📅 Agendado - Nova visita marcada</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Feedback da Visita *</label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            required
                            rows={6}
                            placeholder="Descreva como foi a visita, o que foi discutido, próximos passos..."
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Próxima Visita (Opcional)</label>
                        <input
                            type="date"
                            value={nextVisitDate}
                            onChange={(e) => setNextVisitDate(e.target.value)}
                        />
                        <small>Se preenchido, será criado um follow-up automaticamente</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={createFollowUp}
                                onChange={(e) => setCreateFollowUp(e.target.checked)}
                            />
                            <span>Criar follow-up automático baseado no resultado</span>
                        </label>
                    </div>

                    <div className={styles.formActions}>
                        <button type="button" onClick={onClose} className={styles.cancelButton}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className={styles.submitButton}>
                            {loading ? 'Salvando...' : '✅ Registrar Visita'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

