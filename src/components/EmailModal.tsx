'use client';

import { useState } from 'react';
import { Restaurant, AnalysisResult } from '@/lib/types';
import { sendEmail, createFollowUp, generateEmailWithAI } from '@/app/actions';
import styles from './EmailModal.module.css';

interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurant: Restaurant | null;
    analysis?: AnalysisResult | null;
}

export default function EmailModal({ isOpen, onClose, restaurant, analysis }: EmailModalProps) {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');

    if (!isOpen || !restaurant) return null;

    const handleSend = async () => {
        if (!subject || !body) return;
        
        setSending(true);
        try {
            if (scheduleDate) {
                // Schedule email
                await createFollowUp(
                    restaurant.id,
                    'email',
                    new Date(scheduleDate).toISOString(),
                    subject,
                    body
                );
            } else {
                // Send immediately
                await sendEmail(restaurant.id, subject, body);
            }
            onClose();
            setSubject('');
            setBody('');
            setScheduleDate('');
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Erro ao enviar email');
        } finally {
            setSending(false);
        }
    };

    const loadTemplate = () => {
        setSubject(`Proposta de Embalagens Premium - ${restaurant.name}`);
        setBody(`Olá,\n\nIdentificamos que ${restaurant.name} tem um grande potencial e gostaríamos de apresentar nossas embalagens premium que podem resolver problemas identificados em suas avaliações.\n\nNossas embalagens são:\n- À prova de vazamento\n- Mantêm a temperatura\n- Apresentação premium\n\nAguardo seu retorno para agendarmos uma apresentação.\n\nAtenciosamente`);
    };

    const generateWithAI = async () => {
        if (!restaurant) return;
        
        setGenerating(true);
        try {
            const result = await generateEmailWithAI(restaurant.id, customInstructions);
            setSubject(result.subject);
            setBody(result.body);
        } catch (error) {
            console.error('Error generating email with AI:', error);
            alert('Erro ao gerar email com IA. Verifique a chave da API.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>📧 Enviar Email - {restaurant.name}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    <div className={styles.formGroup}>
                        <label>Assunto</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Assunto do email"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Mensagem</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Corpo do email"
                            className={styles.textarea}
                            rows={10}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>
                            <input
                                type="checkbox"
                                checked={!!scheduleDate}
                                onChange={(e) => {
                                    if (!e.target.checked) {
                                        setScheduleDate('');
                                    } else {
                                        const tomorrow = new Date();
                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                        setScheduleDate(tomorrow.toISOString().split('T')[0]);
                                    }
                                }}
                            />
                            Agendar envio
                        </label>
                        {scheduleDate && (
                            <input
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className={styles.input}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        )}
                    </div>

                    <div className={styles.formGroup}>
                        <label>Instruções Personalizadas (opcional)</label>
                        <input
                            type="text"
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            placeholder="Ex: Focar em embalagens para pizza, mencionar desconto especial..."
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.actions}>
                        <div className={styles.templateActions}>
                            <button onClick={loadTemplate} className={styles.templateButton}>
                                📝 Template Básico
                            </button>
                            <button 
                                onClick={generateWithAI}
                                disabled={generating}
                                className={styles.aiButton}
                            >
                                {generating ? '🤖 Gerando...' : '🤖 Gerar com IA'}
                            </button>
                        </div>
                        <div className={styles.sendActions}>
                            <button onClick={onClose} className={styles.cancelButton}>
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSend}
                                disabled={!subject || !body || sending}
                                className={styles.sendButton}
                            >
                                {sending ? 'Enviando...' : scheduleDate ? 'Agendar' : 'Enviar Agora'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

