'use client';

import { useState, useEffect, useRef } from 'react';
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
    const [uploading, setUploading] = useState<string | null>(null); // 'crmLogo' ou 'crmFavicon'
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const logoFileInputRef = useRef<HTMLInputElement>(null);
    const faviconFileInputRef = useRef<HTMLInputElement>(null);

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
            console.log('💾 Salvando configurações:', settings);
            
            const response = await fetch('/api/system-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            const data = await response.json();
            console.log('📥 Resposta do servidor:', { status: response.status, data });

            if (response.ok) {
                setMessage({ type: 'success', text: '✅ Configurações salvas com sucesso! Recarregue a página para ver as alterações.' });
                setSettings(data.settings);
            } else {
                const errorMsg = data.error || data.message || 'Erro ao salvar configurações';
                console.error('❌ Erro na resposta:', errorMsg, data);
                setMessage({ 
                    type: 'error', 
                    text: `❌ ${errorMsg}${data.details ? ` (${JSON.stringify(data.details)})` : ''}` 
                });
            }
        } catch (error: any) {
            console.error('❌ Erro ao salvar:', error);
            setMessage({ 
                type: 'error', 
                text: `❌ Erro ao salvar configurações: ${error.message || 'Erro desconhecido'}` 
            });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof SystemSettings, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleLogoUpload = async (file: File) => {
        setUploading('crmLogo');
        setMessage(null);
        
        try {
            const formData = new FormData();
            formData.append('logo', file);
            formData.append('type', 'crmLogo');

            const response = await fetch('/api/system-settings/upload-logo', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok && data.logoUrl) {
                setSettings(prev => ({ ...prev, crmLogo: data.logoUrl }));
                setMessage({ type: 'success', text: '✅ Logo enviada com sucesso!' });
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error || 'Erro ao fazer upload da logo'}` });
            }
        } catch (error: any) {
            console.error('Erro ao fazer upload:', error);
            setMessage({ type: 'error', text: '❌ Erro ao fazer upload da logo' });
        } finally {
            setUploading(null);
        }
    };

    const handleFaviconUpload = async (file: File) => {
        setUploading('crmFavicon');
        setMessage(null);
        
        try {
            const formData = new FormData();
            formData.append('logo', file);
            formData.append('type', 'crmFavicon');

            const response = await fetch('/api/system-settings/upload-logo', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok && data.logoUrl) {
                setSettings(prev => ({ ...prev, crmFavicon: data.logoUrl }));
                setMessage({ type: 'success', text: '✅ Favicon enviado com sucesso!' });
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error || 'Erro ao fazer upload do favicon'}` });
            }
        } catch (error: any) {
            console.error('Erro ao fazer upload:', error);
            setMessage({ type: 'error', text: '❌ Erro ao fazer upload do favicon' });
        } finally {
            setUploading(null);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'crmLogo' | 'crmFavicon') => {
        const file = e.target.files?.[0];
        if (file) {
            if (type === 'crmLogo') {
                handleLogoUpload(file);
            } else {
                handleFaviconUpload(file);
            }
        }
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
                        <label>Logo do Sistema</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ flex: '0 0 auto' }}>
                                {settings.crmLogo && (
                                    <div style={{ 
                                        width: '120px', 
                                        height: '120px', 
                                        border: '1px solid var(--card-border)', 
                                        borderRadius: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        background: 'var(--background)'
                                    }}>
                                        <img 
                                            src={settings.crmLogo} 
                                            alt="Logo" 
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                        />
                                    </div>
                                )}
                                <input
                                    ref={logoFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileInputChange(e, 'crmLogo')}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => logoFileInputRef.current?.click()}
                                    disabled={uploading === 'crmLogo'}
                                    className={`${styles.button} ${styles.secondary}`}
                                    style={{ marginTop: '0.5rem', width: '100%' }}
                                >
                                    {uploading === 'crmLogo' ? '⏳ Enviando...' : settings.crmLogo ? '📷 Alterar Logo' : '📷 Fazer Upload'}
                                </button>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                    Ou insira uma URL:
                                </label>
                                <input
                                    type="url"
                                    value={settings.crmLogo || ''}
                                    onChange={(e) => handleChange('crmLogo', e.target.value)}
                                    placeholder="https://exemplo.com/logo.png"
                                    style={{ width: '100%' }}
                                />
                                <small>Logo exibida na sidebar (opcional). Deixe vazio para usar inicial do nome.</small>
                            </div>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Favicon</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ flex: '0 0 auto' }}>
                                {settings.crmFavicon && (
                                    <div style={{ 
                                        width: '64px', 
                                        height: '64px', 
                                        border: '1px solid var(--card-border)', 
                                        borderRadius: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        background: 'var(--background)'
                                    }}>
                                        <img 
                                            src={settings.crmFavicon} 
                                            alt="Favicon" 
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                        />
                                    </div>
                                )}
                                <input
                                    ref={faviconFileInputRef}
                                    type="file"
                                    accept="image/*,.ico"
                                    onChange={(e) => handleFileInputChange(e, 'crmFavicon')}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => faviconFileInputRef.current?.click()}
                                    disabled={uploading === 'crmFavicon'}
                                    className={`${styles.button} ${styles.secondary}`}
                                    style={{ marginTop: '0.5rem', width: '100%' }}
                                >
                                    {uploading === 'crmFavicon' ? '⏳ Enviando...' : settings.crmFavicon ? '📷 Alterar Favicon' : '📷 Fazer Upload'}
                                </button>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                    Ou insira uma URL:
                                </label>
                                <input
                                    type="url"
                                    value={settings.crmFavicon || ''}
                                    onChange={(e) => handleChange('crmFavicon', e.target.value)}
                                    placeholder="https://exemplo.com/favicon.ico"
                                    style={{ width: '100%' }}
                                />
                                <small>Ícone exibido na aba do navegador (opcional). Tamanho recomendado: 32x32px ou 16x16px.</small>
                            </div>
                        </div>
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
                        disabled={saving}
                        className={`${styles.button} ${styles.primary}`}
                    >
                        {saving ? '⏳ Salvando...' : '💾 Salvar Configurações'}
                    </button>
                    <button 
                        type="button"
                        onClick={fetchSettings}
                        disabled={saving}
                        className={`${styles.button} ${styles.secondary}`}
                    >
                        🔄 Restaurar
                    </button>
                </div>
            </form>
        </div>
    );
}
