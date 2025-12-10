'use client';

import { useState, useEffect } from 'react';
import { getApiKeysConfig, saveApiKey, removeApiKey } from './api-keys-actions';
import styles from './Settings.module.css';

interface ApiKeyConfig {
    openaiApiKey: string;
    googleMapsApiKey: string;
    googleAiApiKey: string;
    hasOpenai: boolean;
    hasGoogleMaps: boolean;
    hasGoogleAi: boolean;
}

export default function ApiKeysClient() {
    const [config, setConfig] = useState<ApiKeyConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newKeyValue, setNewKeyValue] = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await getApiKeysConfig();
            setConfig(data);
        } catch (error) {
            console.error('Erro ao carregar config:', error);
            setMessage({ type: 'error', text: 'Erro ao carregar configurações de API' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = async (keyType: 'openai' | 'googleMaps' | 'googleAi') => {
        if (!newKeyValue.trim()) {
            setMessage({ type: 'error', text: '❌ Digite uma chave válida' });
            return;
        }
        setSaving(keyType);
        setMessage(null);
        try {
            const result = await saveApiKey(keyType, newKeyValue.trim());
            if (result.success) {
                setMessage({ type: 'success', text: `✅ ${result.message}` });
                setEditingKey(null);
                setNewKeyValue('');
                await loadConfig();
            } else {
                setMessage({ type: 'error', text: `❌ ${result.message}` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '❌ Erro ao salvar chave' });
        } finally {
            setSaving(null);
        }
    };

    const handleRemoveKey = async (keyType: 'openai' | 'googleMaps' | 'googleAi') => {
        if (!confirm('Tem certeza que deseja remover esta chave?')) return;
        setSaving(keyType);
        setMessage(null);
        try {
            const result = await removeApiKey(keyType);
            if (result.success) {
                setMessage({ type: 'success', text: `✅ ${result.message}` });
                await loadConfig();
            } else {
                setMessage({ type: 'error', text: `❌ ${result.message}` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '❌ Erro ao remover chave' });
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Carregando...
            </div>
        );
    }

    const renderKeyCard = (
        keyType: 'openai' | 'googleMaps' | 'googleAi',
        icon: string,
        title: string,
        description: string,
        hasKey: boolean,
        maskedKey: string,
        placeholder: string
    ) => (
        <div className={styles.formGroup} style={{ 
            padding: '1rem', 
            background: 'var(--card-bg)', 
            borderRadius: '8px',
            border: '1px solid var(--card-border)',
            marginBottom: '1rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>
                        {icon} {title}
                    </label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        {description}
                    </p>
                </div>
                <span className={`${styles.badge} ${hasKey ? styles.connected : styles.disconnected}`} style={{ 
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.375rem',
                    fontWeight: 600
                }}>
                    {hasKey ? '✅ Configurada' : '⚠️ Não configurada'}
                </span>
            </div>
            {editingKey === keyType ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <input
                        type="password"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder={placeholder}
                        className={styles.input}
                        style={{ flex: 1 }}
                        autoFocus
                    />
                    <button 
                        onClick={() => handleSaveKey(keyType)} 
                        disabled={saving === keyType} 
                        className={`${styles.button} ${styles.primary}`}
                        style={{ padding: '0.625rem 1rem', minWidth: 'auto' }}
                    >
                        {saving === keyType ? '⏳' : '💾'}
                    </button>
                    <button 
                        onClick={() => { setEditingKey(null); setNewKeyValue(''); }} 
                        className={`${styles.button} ${styles.secondary}`}
                        style={{ padding: '0.625rem 1rem', minWidth: 'auto' }}
                    >
                        ✕
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <input 
                        type="text" 
                        value={maskedKey || 'Não configurada'} 
                        disabled 
                        className={styles.input} 
                        style={{ flex: 1, opacity: hasKey ? 1 : 0.6 }} 
                    />
                    <button 
                        onClick={() => setEditingKey(keyType)} 
                        className={`${styles.button} ${styles.primary}`}
                        style={{ padding: '0.625rem 1rem', minWidth: 'auto' }}
                    >
                        {hasKey ? '✏️' : '➕'}
                    </button>
                    {hasKey && (
                        <button 
                            onClick={() => handleRemoveKey(keyType)} 
                            disabled={saving === keyType} 
                            className={`${styles.button} ${styles.danger}`}
                            style={{ padding: '0.625rem 1rem', minWidth: 'auto' }}
                        >
                            🗑️
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div>
            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.text}
                </div>
            )}

            {renderKeyCard('openai', '🤖', 'OpenAI (GPT-4)', 'Análise de restaurantes, emails e estratégias', config?.hasOpenai || false, config?.openaiApiKey || '', 'sk-...')}
            {renderKeyCard('googleMaps', '🗺️', 'Google Maps', 'Localização de restaurantes no mapa', config?.hasGoogleMaps || false, config?.googleMapsApiKey || '', 'AIza...')}
            {renderKeyCard('googleAi', '✨', 'Google AI (Gemini)', 'Alternativa/backup para OpenAI', config?.hasGoogleAi || false, config?.googleAiApiKey || '', 'AIza...')}
        </div>
    );
}
