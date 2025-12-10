'use client';

import { useState } from 'react';
import { createZona, updateZona, deleteZona, seedZonasPadrao, seedZonasSorocaba, ZonaCepData } from './actions';
import styles from './page.module.css';

interface Zona {
    id: string;
    zonaNome: string;
    cepInicial: string;
    cepFinal: string;
    regiao?: string;
    ativo: boolean;
}

interface ZonasClientProps {
    initialZonas: Zona[];
}

// Formatar CEP para exibição (12345678 -> 12345-678)
function formatCep(cep: string): string {
    const cleaned = cep.replace(/[^0-9]/g, '');
    if (cleaned.length === 8) {
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    return cep;
}

export default function ZonasClient({ initialZonas }: ZonasClientProps) {
    const [zonas, setZonas] = useState<Zona[]>(initialZonas);
    const [showModal, setShowModal] = useState(false);
    const [editingZona, setEditingZona] = useState<Zona | null>(null);
    const [formData, setFormData] = useState({
        zonaNome: '',
        cepInicial: '',
        cepFinal: '',
        regiao: '',
        ativo: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [seeding, setSeeding] = useState(false);
    const [seedingSorocaba, setSeedingSorocaba] = useState(false);

    const activeZonas = zonas.filter(z => z.ativo);
    const inactiveZonas = zonas.filter(z => !z.ativo);

    const filteredZonas = zonas.filter(z =>
        z.zonaNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        z.cepInicial.includes(searchTerm) ||
        z.cepFinal.includes(searchTerm)
    );

    const handleOpenModal = (zona?: Zona) => {
        if (zona) {
            setEditingZona(zona);
            setFormData({
                zonaNome: zona.zonaNome,
                cepInicial: formatCep(zona.cepInicial),
                cepFinal: formatCep(zona.cepFinal),
                regiao: zona.regiao || '',
                ativo: zona.ativo
            });
        } else {
            setEditingZona(null);
            setFormData({
                zonaNome: '',
                cepInicial: '',
                cepFinal: '',
                regiao: '',
                ativo: true
            });
        }
        setError(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingZona(null);
        setFormData({
            zonaNome: '',
            cepInicial: '',
            cepFinal: '',
            regiao: '',
            ativo: true
        });
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (editingZona) {
                const updated = await updateZona(editingZona.id, formData);
                setZonas(prev => prev.map(z => z.id === updated.id ? {
                    ...updated,
                    cepInicial: updated.cepInicial,
                    cepFinal: updated.cepFinal
                } : z));
            } else {
                const created = await createZona(formData);
                setZonas(prev => [{
                    ...created,
                    cepInicial: created.cepInicial,
                    cepFinal: created.cepFinal
                }, ...prev]);
            }

            handleCloseModal();
        } catch (error: any) {
            setError(error.message || 'Erro ao salvar zona');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta zona?')) return;

        try {
            await deleteZona(id);
            setZonas(prev => prev.filter(z => z.id !== id));
        } catch (error: any) {
            alert(error.message || 'Erro ao excluir zona');
        }
    };

    const handleSeedZonas = async () => {
        if (!confirm('Deseja popular o sistema com as zonas padrão de São Paulo? Isso criará 20 zonas pré-configuradas.')) return;
        
        setSeeding(true);
        try {
            const result = await seedZonasPadrao();
            alert(result.message || `${result.created} zonas criadas, ${result.skipped} já existiam`);
            // Recarregar a página para ver as novas zonas
            window.location.reload();
        } catch (error: any) {
            alert(error.message || 'Erro ao popular zonas padrão');
        } finally {
            setSeeding(false);
        }
    };

    const handleSeedZonasSorocaba = async () => {
        if (!confirm('Deseja adicionar as zonas de Sorocaba e atribuí-las ao executivo Cicero?\n\nIsso criará 5 zonas de Sorocaba e as atribuirá automaticamente ao executivo Cicero.')) return;
        
        setSeedingSorocaba(true);
        try {
            const result = await seedZonasSorocaba();
            if (result.success) {
                alert(`✅ ${result.message || `${result.created} zonas criadas`}`);
                window.location.reload();
            } else {
                alert(`❌ ${result.message || 'Erro ao adicionar zonas de Sorocaba'}`);
            }
        } catch (error: any) {
            alert(error.message || 'Erro ao adicionar zonas de Sorocaba');
        } finally {
            setSeedingSorocaba(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1>🗺️ Gerenciar Zonas de Atendimento</h1>
                    <p>Configure as zonas geográficas baseadas em ranges de CEP</p>
                </div>
                <div className={styles.headerActions}>
                    <button 
                        className={`${styles.seedButton} ${styles.seedButtonPrimary}`}
                        onClick={handleSeedZonas}
                        disabled={seeding}
                    >
                        {seeding ? '⏳ Populando...' : '🌱 Popular Zonas Pré-Cadastradas'}
                    </button>
                    <button 
                        className={`${styles.seedButton} ${styles.seedButtonSorocaba}`}
                        onClick={handleSeedZonasSorocaba}
                        disabled={seedingSorocaba}
                    >
                        {seedingSorocaba ? '⏳ Adicionando...' : '🏙️ Adicionar Zonas Sorocaba'}
                    </button>
                    <button className={styles.newButton} onClick={() => handleOpenModal()}>
                        ➕ Nova Zona
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.stats}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#eff6ff' }}>
                        <span>🗺️</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Total de Zonas</div>
                        <div className={styles.statValue}>{zonas.length}</div>
                    </div>
                </div>
                
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#dcfce7' }}>
                        <span>✅</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Zonas Ativas</div>
                        <div className={styles.statValue}>{activeZonas.length}</div>
                    </div>
                </div>
                
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#fef3c7' }}>
                        <span>⏸️</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Zonas Inativas</div>
                        <div className={styles.statValue}>{inactiveZonas.length}</div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="🔍 Buscar zona por nome ou CEP..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* Lista de Zonas */}
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Zona</th>
                            <th>CEP Inicial</th>
                            <th>CEP Final</th>
                            <th>Região</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredZonas.length === 0 ? (
                            <tr>
                                <td colSpan={7} className={styles.emptyState}>
                                    {searchTerm ? 'Nenhuma zona encontrada' : 'Nenhuma zona cadastrada'}
                                </td>
                            </tr>
                        ) : (
                            filteredZonas.map((zona, index) => {
                                // Gerar ID numérico baseado na posição (1, 2, 3...)
                                const zonaId = index + 1;
                                return (
                                    <tr key={zona.id}>
                                        <td>
                                            <strong style={{ color: 'var(--primary)', fontSize: '0.875rem' }}>#{zonaId}</strong>
                                        </td>
                                        <td>
                                            <strong>{zona.zonaNome}</strong>
                                        </td>
                                        <td>{formatCep(zona.cepInicial)}</td>
                                        <td>{formatCep(zona.cepFinal)}</td>
                                        <td>
                                            <span style={{ 
                                                fontSize: '0.8125rem', 
                                                color: 'var(--text-muted)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                background: 'var(--card-bg)',
                                                border: '1px solid var(--card-border)'
                                            }}>
                                                {zona.regiao || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={zona.ativo ? styles.statusActive : styles.statusInactive}>
                                                {zona.ativo ? '✅ Ativa' : '⏸️ Inativa'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                <button
                                                    className={styles.btnIcon}
                                                    onClick={() => handleOpenModal(zona)}
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className={`${styles.btnIcon} ${styles.delete}`}
                                                    onClick={() => handleDelete(zona.id)}
                                                    title="Excluir"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingZona ? '✏️ Editar Zona' : '➕ Nova Zona'}</h2>
                            <button className={styles.btnClose} onClick={handleCloseModal}>✕</button>
                        </div>

                        {error && (
                            <div className={styles.errorMessage}>
                                ⚠️ {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Nome da Zona *</label>
                                <input
                                    type="text"
                                    value={formData.zonaNome}
                                    onChange={e => setFormData({...formData, zonaNome: e.target.value})}
                                    required
                                    placeholder="Ex: SP Zona Norte"
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>CEP Inicial *</label>
                                    <input
                                        type="text"
                                        value={formData.cepInicial}
                                        onChange={e => {
                                            let value = e.target.value.replace(/[^0-9]/g, '');
                                            if (value.length > 5) {
                                                value = `${value.slice(0, 5)}-${value.slice(5, 8)}`;
                                            }
                                            setFormData({...formData, cepInicial: value});
                                        }}
                                        required
                                        placeholder="02000-000"
                                        maxLength={9}
                                    />
                                    <small className={styles.helpText}>Formato: 12345-678</small>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>CEP Final *</label>
                                    <input
                                        type="text"
                                        value={formData.cepFinal}
                                        onChange={e => {
                                            let value = e.target.value.replace(/[^0-9]/g, '');
                                            if (value.length > 5) {
                                                value = `${value.slice(0, 5)}-${value.slice(5, 8)}`;
                                            }
                                            setFormData({...formData, cepFinal: value});
                                        }}
                                        required
                                        placeholder="02999-999"
                                        maxLength={9}
                                    />
                                    <small className={styles.helpText}>Formato: 12345-678</small>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Região</label>
                                <input
                                    type="text"
                                    value={formData.regiao}
                                    onChange={e => setFormData({...formData, regiao: e.target.value})}
                                    placeholder="Ex: SP Capital, Grande SP, ABC, Interior"
                                />
                                <small className={styles.helpText}>Opcional: Classificação da região</small>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.checkbox}>
                                    <input
                                        type="checkbox"
                                        checked={formData.ativo}
                                        onChange={e => setFormData({...formData, ativo: e.target.checked})}
                                    />
                                    <span>Zona Ativa</span>
                                </label>
                            </div>

                            <div className={styles.modalFooter}>
                                <button type="button" className={styles.btnSecondary} onClick={handleCloseModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                                    {loading ? '⏳ Salvando...' : '💾 Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
