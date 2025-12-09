'use client';

import { useState, useEffect } from 'react';
import { getAIAgents, saveAIAgent, resetAIAgentToDefault } from './ai-agents-actions';
import { AIAgentData, DEFAULT_AGENTS } from '@/lib/ai-agents-data';
import styles from './page.module.css';

export default function AIAgentsClient() {
    const [agents, setAgents] = useState<AIAgentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState<AIAgentData | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadAgents();
    }, []);

    const loadAgents = async () => {
        setLoading(true);
        try {
            let data = await getAIAgents();
            // Se não tem agentes no banco, usar os defaults
            if (data.length === 0) {
                data = DEFAULT_AGENTS.map((a, i) => ({ ...a, id: `default-${i}` }));
            }
            setAgents(data);
        } catch (error) {
            console.error('Erro ao carregar agentes:', error);
            setAgents(DEFAULT_AGENTS.map((a, i) => ({ ...a, id: `default-${i}` })));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedAgent) return;
        setSaving(true);
        setMessage(null);

        try {
            const result = await saveAIAgent(selectedAgent);
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                await loadAgents();
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao salvar' });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!selectedAgent) return;
        if (!confirm('Restaurar este agente para as configurações padrão?')) return;

        setSaving(true);
        try {
            const result = await resetAIAgentToDefault(selectedAgent.code);
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                await loadAgents();
                setSelectedAgent(null);
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao resetar' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.section}>
                <h2>🤖 Agentes de IA</h2>
                <p>Carregando...</p>
            </div>
        );
    }

    return (
        <div className={styles.section}>
            <h2>🤖 Agentes de IA</h2>
            <p className={styles.description}>
                Configure os prompts e parâmetros dos agentes de inteligência artificial.
            </p>

            {message && (
                <div style={{ 
                    padding: '0.75rem', 
                    borderRadius: '6px', 
                    marginBottom: '1rem', 
                    background: message.type === 'success' ? '#10b98120' : '#ef444420', 
                    color: message.type === 'success' ? '#10b981' : '#ef4444' 
                }}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1rem' }}>
                {/* Lista de Agentes */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.7 }}>Agentes Disponíveis</h3>
                    {agents.map(agent => (
                        <button
                            key={agent.code}
                            onClick={() => setSelectedAgent(agent)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                marginBottom: '0.5rem',
                                border: 'none',
                                borderRadius: '6px',
                                background: selectedAgent?.code === agent.code ? 'var(--primary-color)' : 'var(--bg-primary)',
                                color: selectedAgent?.code === agent.code ? 'white' : 'inherit',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span style={{ opacity: agent.active ? 1 : 0.5 }}>
                                {agent.active ? '🟢' : '⚪'}
                            </span>
                            <div>
                                <div style={{ fontWeight: 500 }}>{agent.name}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                    {agent.isDefault ? '📌 Padrão' : '✏️ Customizado'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Editor do Agente */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '1rem' }}>
                    {selectedAgent ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3>{selectedAgent.name}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={handleReset} disabled={saving} className={styles.btnSecondary}>
                                        🔄 Resetar
                                    </button>
                                    <button onClick={handleSave} disabled={saving} className={styles.btnPrimary}>
                                        {saving ? '⏳' : '💾'} Salvar
                                    </button>
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label>Descrição</label>
                                <input
                                    type="text"
                                    value={selectedAgent.description || ''}
                                    onChange={(e) => setSelectedAgent({ ...selectedAgent, description: e.target.value })}
                                    className={styles.input}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div className={styles.field}>
                                    <label>Modelo</label>
                                    <select
                                        value={selectedAgent.model}
                                        onChange={(e) => setSelectedAgent({ ...selectedAgent, model: e.target.value })}
                                        className={styles.input}
                                    >
                                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                                        <option value="gpt-4o">GPT-4o</option>
                                        <option value="gpt-4">GPT-4</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label>Temperatura ({selectedAgent.temperature})</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={selectedAgent.temperature}
                                        onChange={(e) => setSelectedAgent({ ...selectedAgent, temperature: parseFloat(e.target.value) })}
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>Max Tokens</label>
                                    <input
                                        type="number"
                                        value={selectedAgent.maxTokens}
                                        onChange={(e) => setSelectedAgent({ ...selectedAgent, maxTokens: parseInt(e.target.value) })}
                                        className={styles.input}
                                    />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label>System Prompt (Instruções do Sistema)</label>
                                <textarea
                                    value={selectedAgent.systemPrompt}
                                    onChange={(e) => setSelectedAgent({ ...selectedAgent, systemPrompt: e.target.value })}
                                    rows={8}
                                    className={styles.input}
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div className={styles.field}>
                                <label>User Prompt Template (Use {`{{variavel}}`} para inserir dados)</label>
                                <textarea
                                    value={selectedAgent.userPromptTemplate}
                                    onChange={(e) => setSelectedAgent({ ...selectedAgent, userPromptTemplate: e.target.value })}
                                    rows={6}
                                    className={styles.input}
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                                <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}>
                                    Variáveis disponíveis: {`{{name}}, {{rating}}, {{reviewCount}}, {{comments}}, {{painPoints}}, {{salesPotential}}, {{projectedDeliveries}}`}
                                </p>
                            </div>

                            <div className={styles.field}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedAgent.active}
                                        onChange={(e) => setSelectedAgent({ ...selectedAgent, active: e.target.checked })}
                                    />
                                    Agente ativo
                                </label>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                            <p>👈 Selecione um agente para editar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
