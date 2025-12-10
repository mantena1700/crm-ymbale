'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface LoginSettings {
    loginTitle: string | null;
    loginSubtitle: string | null;
    loginMessage: string | null;
    loginShowMessage: boolean;
    loginBackgroundColor: string | null;
    loginLogo: string | null;
}

export default function LoginCustomizationClient() {
    const [settings, setSettings] = useState<LoginSettings>({
        loginTitle: null,
        loginSubtitle: null,
        loginMessage: null,
        loginShowMessage: false,
        loginBackgroundColor: null,
        loginLogo: null,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/system-settings');
            if (response.ok) {
                const data = await response.json();
                setSettings({
                    loginTitle: data.loginTitle || null,
                    loginSubtitle: data.loginSubtitle || null,
                    loginMessage: data.loginMessage || null,
                    loginShowMessage: data.loginShowMessage || false,
                    loginBackgroundColor: data.loginBackgroundColor || null,
                    loginLogo: data.loginLogo || null,
                });
            }
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch('/api/system-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: 'Configurações de login salvas com sucesso!' });
                setSettings(data.settings);
            } else {
                setMessage({ type: 'error', text: data.error || 'Erro ao salvar configurações' });
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof LoginSettings, value: string | boolean) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div className={styles.section}>
                <h2>🎨 Personalização da Página de Login</h2>
                <p className={styles.description}>Carregando...</p>
            </div>
        );
    }

    return (
        <div className={styles.section}>
            <h2>🎨 Personalização da Página de Login</h2>
            <p className={styles.description}>
                Personalize a aparência e mensagens da página de login do sistema.
            </p>

            {message && (
                <div className={`${styles.message} ${message.type === 'success' ? styles.successMessage : ''}`} style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                    border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className={styles.field}>
                    <label htmlFor="loginTitle">Título da Página</label>
                    <input
                        id="loginTitle"
                        type="text"
                        className={styles.input}
                        value={settings.loginTitle || ''}
                        onChange={(e) => handleChange('loginTitle', e.target.value)}
                        placeholder="Ex: Bem-vindo ao CRM"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="loginSubtitle">Subtítulo</label>
                    <input
                        id="loginSubtitle"
                        type="text"
                        className={styles.input}
                        value={settings.loginSubtitle || ''}
                        onChange={(e) => handleChange('loginSubtitle', e.target.value)}
                        placeholder="Ex: Sistema de Gestão Comercial"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="loginMessage">Mensagem Personalizada</label>
                    <textarea
                        id="loginMessage"
                        className={styles.input}
                        value={settings.loginMessage || ''}
                        onChange={(e) => handleChange('loginMessage', e.target.value)}
                        placeholder="Digite uma mensagem personalizada para exibir na página de login"
                        rows={4}
                        style={{ resize: 'vertical', minHeight: '100px' }}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="loginShowMessage">Exibir Mensagem</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                            id="loginShowMessage"
                            type="checkbox"
                            checked={settings.loginShowMessage}
                            onChange={(e) => handleChange('loginShowMessage', e.target.checked)}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--ds-text-muted)' }}>
                            Mostrar mensagem personalizada na página de login
                        </span>
                    </div>
                </div>

                <div className={styles.field}>
                    <label htmlFor="loginBackgroundColor">Cor de Fundo</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                        <input
                            id="loginBackgroundColor"
                            type="color"
                            value={settings.loginBackgroundColor || '#0f0c29'}
                            onChange={(e) => handleChange('loginBackgroundColor', e.target.value)}
                            style={{ width: '60px', height: '40px', borderRadius: '8px', border: '1px solid var(--ds-border)', cursor: 'pointer' }}
                        />
                        <input
                            type="text"
                            className={styles.input}
                            value={settings.loginBackgroundColor || ''}
                            onChange={(e) => handleChange('loginBackgroundColor', e.target.value)}
                            placeholder="#0f0c29"
                            style={{ flex: 1 }}
                        />
                    </div>
                </div>

                <div className={styles.field}>
                    <label htmlFor="loginLogo">URL do Logo</label>
                    <input
                        id="loginLogo"
                        type="text"
                        className={styles.input}
                        value={settings.loginLogo || ''}
                        onChange={(e) => handleChange('loginLogo', e.target.value)}
                        placeholder="https://exemplo.com/logo.png ou /logo.png"
                    />
                    <p className={styles.helpText}>
                        URL completa ou caminho relativo para a imagem do logo
                    </p>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <button
                        type="submit"
                        className={styles.button}
                        disabled={saving}
                    >
                        {saving ? 'Salvando...' : '💾 Salvar Configurações'}
                    </button>
                    <button
                        type="button"
                        className={styles.button}
                        onClick={() => {
                            setSettings({
                                loginTitle: null,
                                loginSubtitle: null,
                                loginMessage: null,
                                loginShowMessage: false,
                                loginBackgroundColor: null,
                                loginLogo: null,
                            });
                        }}
                        style={{ backgroundColor: 'var(--ds-gray-600)', opacity: 0.8 }}
                    >
                        🔄 Restaurar Padrão
                    </button>
                </div>
            </form>
        </div>
    );
}

