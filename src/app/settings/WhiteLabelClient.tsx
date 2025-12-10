'use client';

import { useState, useEffect } from 'react';
import styles from './Settings.module.css';

interface SystemSettings {
    id: string;
    crmName: string;
    crmLogo: string | null;
    crmFavicon: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    companyName: string | null;
    companyEmail: string | null;
    companyPhone: string | null;
}

export default function WhiteLabelClient() {
    const [settings, setSettings] = useState<SystemSettings>({
        id: 'system',
        crmName: 'Ymbale',
        crmLogo: null,
        crmFavicon: null,
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        accentColor: '#10b981',
        companyName: null,
        companyEmail: null,
        companyPhone: null,
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
                setSettings(data);
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
                setMessage({ type: 'success', text: 'Configurações salvas com sucesso! Recarregue a página para ver as alterações.' });
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

    const handleChange = (field: keyof SystemSettings, value: string) => {
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
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Personalize a identidade visual do seu CRM
            </p>
            
            <form onSubmit={handleSubmit}>
                {message && (
                    <div className={`${styles.message} ${styles[message.type]}`}>
                        {message.text}
                    </div>
                )}

                <div className={styles.section}>
                    <h3>Identidade da Marca</h3>
                    
                    <div className={styles.formGroup}>
                        <label>Nome do CRM</label>
                        <input
                            type="text"
                            value={settings.crmName}
                            onChange={(e) => handleChange('crmName', e.target.value)}
                            placeholder="Ex: Ymbale"
                            required
                        />
                        <small>Nome exibido na sidebar e no título do sistema</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label>URL da Logo</label>
                        <input
                            type="url"
                            value={settings.crmLogo || ''}
                            onChange={(e) => handleChange('crmLogo', e.target.value)}
                            placeholder="https://exemplo.com/logo.png"
                        />
                        <small>Logo exibida na sidebar (opcional). Deixe vazio para usar inicial do nome.</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label>URL do Favicon</label>
                        <input
                            type="url"
                            value={settings.crmFavicon || ''}
                            onChange={(e) => handleChange('crmFavicon', e.target.value)}
                            placeholder="https://exemplo.com/favicon.ico"
                        />
                        <small>Ícone exibido na aba do navegador (opcional)</small>
                    </div>
                </div>

                <div className={styles.section}>
                    <h3>Cores do Sistema</h3>
                    
                    <div className={styles.colorGrid}>
                        <div className={styles.formGroup}>
                            <label>Cor Primária</label>
                            <div className={styles.colorInput}>
                                <input
                                    type="color"
                                    value={settings.primaryColor}
                                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={settings.primaryColor}
                                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                                    placeholder="#6366f1"
                                    pattern="^#[0-9A-Fa-f]{6}$"
                                />
                            </div>
                            <small>Cor principal dos botões e elementos de destaque</small>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Cor Secundária</label>
                            <div className={styles.colorInput}>
                                <input
                                    type="color"
                                    value={settings.secondaryColor}
                                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={settings.secondaryColor}
                                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                                    placeholder="#8b5cf6"
                                    pattern="^#[0-9A-Fa-f]{6}$"
                                />
                            </div>
                            <small>Cor usada em gradientes e elementos secundários</small>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Cor de Destaque</label>
                            <div className={styles.colorInput}>
                                <input
                                    type="color"
                                    value={settings.accentColor}
                                    onChange={(e) => handleChange('accentColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={settings.accentColor}
                                    onChange={(e) => handleChange('accentColor', e.target.value)}
                                    placeholder="#10b981"
                                    pattern="^#[0-9A-Fa-f]{6}$"
                                />
                            </div>
                            <small>Cor para badges e indicadores de sucesso</small>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <h3>Informações da Empresa</h3>
                    
                    <div className={styles.formGroup}>
                        <label>Nome da Empresa</label>
                        <input
                            type="text"
                            value={settings.companyName || ''}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            placeholder="Sua Empresa Ltda"
                        />
                        <small>Nome da empresa proprietária do sistema</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label>E-mail de Contato</label>
                        <input
                            type="email"
                            value={settings.companyEmail || ''}
                            onChange={(e) => handleChange('companyEmail', e.target.value)}
                            placeholder="contato@empresa.com"
                        />
                        <small>E-mail para contato e suporte</small>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Telefone</label>
                        <input
                            type="tel"
                            value={settings.companyPhone || ''}
                            onChange={(e) => handleChange('companyPhone', e.target.value)}
                            placeholder="(11) 99999-9999"
                        />
                        <small>Telefone para contato</small>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button 
                        type="submit" 
                        className={styles.saveBtn}
                        disabled={saving}
                    >
                        {saving ? '⏳ Salvando...' : '💾 Salvar Configurações'}
                    </button>
                    <button 
                        type="button" 
                        className={styles.cancelBtn}
                        onClick={fetchSettings}
                        disabled={saving}
                    >
                        🔄 Restaurar
                    </button>
                </div>
            </form>
        </div>
    );
}


