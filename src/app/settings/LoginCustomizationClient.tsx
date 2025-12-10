'use client';

import { useState, useEffect } from 'react';
import styles from './Settings.module.css';

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
                setMessage({ type: 'success', text: '✅ Configurações de login salvas com sucesso!' });
                setSettings(data.settings);
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error || 'Erro ao salvar configurações'}` });
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            setMessage({ type: 'error', text: '❌ Erro ao salvar configurações' });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof LoginSettings, value: string | boolean) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Carregando...
            </div>
        );
    }

    return (
        <div>
            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className={styles.section}>
                    <h3>Texto e Mensagens</h3>
                    
                    <div className={styles.formGroup}>
                        <label>Título da Página</label>
                        <input
                            type="text"
                            value={settings.loginTitle || ''}
                            onChange={(e) => handleChange('loginTitle', e.target.value)}
                            placeholder="Ex: Bem-vindo ao CRM"
                        />
                        <small>Título principal exibido na página de login</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Subtítulo</label>
                        <input
                            type="text"
                            value={settings.loginSubtitle || ''}
                            onChange={(e) => handleChange('loginSubtitle', e.target.value)}
                            placeholder="Ex: Sistema de Gestão Comercial"
                        />
                        <small>Subtítulo exibido abaixo do título</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Mensagem Personalizada</label>
                        <textarea
                            value={settings.loginMessage || ''}
                            onChange={(e) => handleChange('loginMessage', e.target.value)}
                            placeholder="Digite uma mensagem personalizada para exibir na página de login"
                            rows={4}
                            style={{ resize: 'vertical', minHeight: '100px' }}
                        />
                        <small>Mensagem opcional para exibir na página de login</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.loginShowMessage}
                                onChange={(e) => handleChange('loginShowMessage', e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span>Exibir mensagem personalizada na página de login</span>
                        </label>
                    </div>
                </div>

                <div className={styles.section}>
                    <h3>Aparência</h3>
                    
                    <div className={styles.formGroup}>
                        <label>Cor de Fundo</label>
                        <div className={styles.colorInput}>
                            <input
                                type="color"
                                value={settings.loginBackgroundColor || '#0f0c29'}
                                onChange={(e) => handleChange('loginBackgroundColor', e.target.value)}
                            />
                            <input
                                type="text"
                                value={settings.loginBackgroundColor || ''}
                                onChange={(e) => handleChange('loginBackgroundColor', e.target.value)}
                                placeholder="#0f0c29"
                            />
                        </div>
                        <small>Cor de fundo da página de login</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label>URL do Logo</label>
                        <input
                            type="text"
                            value={settings.loginLogo || ''}
                            onChange={(e) => handleChange('loginLogo', e.target.value)}
                            placeholder="https://exemplo.com/logo.png ou /logo.png"
                        />
                        <small>URL completa ou caminho relativo para a imagem do logo</small>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button 
                        type="submit"
                        disabled={saving}
                        className={`${styles.button} ${styles.primary}`}
                    >
                        {saving ? '⏳ Salvando...' : '💾 Salvar Configurações'}
                    </button>
                    <button 
                        type="button"
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
                        disabled={saving}
                        className={`${styles.button} ${styles.secondary}`}
                    >
                        🔄 Restaurar Padrão
                    </button>
                </div>
            </form>
        </div>
    );
}
