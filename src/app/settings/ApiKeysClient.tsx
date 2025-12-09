'use client';

import { useState, useEffect } from 'react';
import { getApiKeysConfig, saveApiKey, removeApiKey } from './api-keys-actions';
import styles from './page.module.css';

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
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = async (keyType: 'openai' | 'googleMaps' | 'googleAi') => {
        if (!newKeyValue.trim()) {
            setMessage({ type: 'error', text: 'Digite uma chave válida' });
            return;
        }
        setSaving(keyType);
        setMessage(null);
        try {
            const result = await saveApiKey(keyType, newKeyValue.trim());
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setEditingKey(null);
                setNewKeyValue('');
                await loadConfig();
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao salvar chave' });
        } finally {
            setSaving(null);
        }
    };

    const handleRemoveKey = async (keyType: 'openai' | 'googleMaps' | 'googleAi') => {
        if (!confirm('Tem certeza que deseja remover esta chave?')) return;
        setSaving(keyType);
        try {
            const result = await removeApiKey(keyType);
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                await loadConfig();
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao remover chave' });
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <div className={styles.section}><h2>🔑 Chaves de API</h2><p>Carregando...</p></div>;

    const renderKeyCard = (
        keyType: 'openai' | 'googleMaps' | 'googleAi',
        icon: string,
        title: string,
        description: string,
        hasKey: boolean,
        maskedKey: string,
        placeholder: string
    ) => (
        <div className={styles.field} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                    <label style={{ fontWeight: 600 }}>{icon} {title}</label>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0.25rem 0 0 0' }}>{description}</p>
                </div>
                <span className={`${styles.badge} ${hasKey ? styles.connected : styles.disconnected}`}>
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
                    <button onClick={() => handleSaveKey(keyType)} disabled={saving === keyType} className={styles.btnPrimary}>
                        {saving === keyType ? '...' : '💾'}
                    </button>
                    <button onClick={() => { setEditingKey(null); setNewKeyValue(''); }} className={styles.btnSecondary}>✕</button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <input type="text" value={maskedKey || 'Não configurada'} disabled className={styles.input} style={{ flex: 1 }} />
                    <button onClick={() => setEditingKey(keyType)} className={styles.btnPrimary}>
                        {hasKey ? '✏️' : '➕'}
                    </button>
                    {hasKey && (
                        <button onClick={() => handleRemoveKey(keyType)} disabled={saving === keyType} className={styles.btnDanger}>🗑️</button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className={styles.section}>
            <h2>🔑 Chaves de API</h2>
            <p className={styles.description}>Configure suas chaves para ativar funcionalidades de IA e mapas.</p>
            
            {message && (
                <div style={{ padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', background: message.type === 'success' ? '#10b98120' : '#ef444420', color: message.type === 'success' ? '#10b981' : '#ef4444' }}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            {renderKeyCard('openai', '🤖', 'OpenAI (GPT-4)', 'Análise de restaurantes, emails e estratégias', config?.hasOpenai || false, config?.openaiApiKey || '', 'sk-...')}
            {renderKeyCard('googleMaps', '🗺️', 'Google Maps', 'Localização de restaurantes no mapa', config?.hasGoogleMaps || false, config?.googleMapsApiKey || '', 'AIza...')}
            {renderKeyCard('googleAi', '✨', 'Google AI (Gemini)', 'Alternativa/backup para OpenAI', config?.hasGoogleAi || false, config?.googleAiApiKey || '', 'AIza...')}
        </div>
    );
}
