'use client';

import { useState } from 'react';
import { createZona, updateZona, deleteZona, ZonaCepData, exportClientesSemZonaToExcel, deleteMultipleRestaurants } from './actions';
import styles from './page.module.css';

interface Zona {
    id: string;
    zonaNome: string;
    cepInicial: string;
    cepFinal: string;
    regiao?: string;
    ativo: boolean;
}

interface ClienteSemZona {
    id: string;
    name: string;
    address: {
        street: string;
        neighborhood: string;
        city: string;
        state: string;
        zip: string;
    };
    status: string;
    salesPotential: string;
    seller: {
        id: string;
        name: string;
    } | null;
    createdAt: Date;
}

interface ZonasClientProps {
    initialZonas: Zona[];
    clientesSemZona: ClienteSemZona[];
}

// Formatar CEP para exibição (12345678 -> 12345-678)
function formatCep(cep: string): string {
    const cleaned = cep.replace(/[^0-9]/g, '');
    if (cleaned.length === 8) {
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    return cep;
}

export default function ZonasClient({ initialZonas, clientesSemZona }: ZonasClientProps) {
    const [zonas, setZonas] = useState<Zona[]>(initialZonas);
    const [clientes, setClientes] = useState<ClienteSemZona[]>(clientesSemZona);
    const [selectedClientes, setSelectedClientes] = useState<Set<string>>(new Set());
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
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
                    cepFinal: updated.cepFinal,
                    regiao: (updated as any).regiao
                } : z));
            } else {
                const created = await createZona(formData);
                setZonas(prev => [{
                    ...created,
                    cepInicial: created.cepInicial,
                    cepFinal: created.cepFinal,
                    regiao: (created as any).regiao
                }, ...prev]);
            }

            handleCloseModal();
        } catch (error: any) {
            setError(error.message || 'Erro ao salvar zona');
        } finally {
            setLoading(false);
        }
    };

    // Funções para gerenciar seleção de clientes
    const handleSelectCliente = (clienteId: string) => {
        setSelectedClientes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clienteId)) {
                newSet.delete(clienteId);
            } else {
                newSet.add(clienteId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedClientes.size === clientes.length) {
            setSelectedClientes(new Set());
        } else {
            setSelectedClientes(new Set(clientes.map(c => c.id)));
        }
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const result = await exportClientesSemZonaToExcel();
            
            if (result.success && result.data) {
                // Converter base64 para Blob
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { 
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });

                // Criar link temporário para download
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = result.filename || `Clientes_Sem_Zona_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                alert(`✅ Planilha exportada com sucesso!\n\n${result.count} cliente(s) exportado(s).`);
            } else {
                alert(`❌ Erro ao exportar planilha.\n\n${result.error || 'Erro desconhecido'}`);
            }
        } catch (error: any) {
            console.error('Erro ao exportar:', error);
            alert(`❌ Erro ao exportar: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedClientes.size === 0) {
            alert('⚠️ Selecione pelo menos um cliente para excluir.');
            return;
        }

        const count = selectedClientes.size;
        if (!confirm(`Tem certeza que deseja excluir ${count} cliente(s) selecionado(s)?\n\nEsta ação não pode ser desfeita!`)) {
            return;
        }

        setDeleting(true);
        try {
            const result = await deleteMultipleRestaurants(Array.from(selectedClientes));
            
            if (result.success) {
                // Remover clientes excluídos da lista
                setClientes(prev => prev.filter(c => !selectedClientes.has(c.id)));
                setSelectedClientes(new Set());
                alert(`✅ ${result.deleted} cliente(s) excluído(s) com sucesso!`);
                // Recarregar a página para atualizar os dados
                window.location.reload();
            } else {
                alert(`❌ Erro ao excluir clientes.\n\n${result.error || 'Erro desconhecido'}`);
            }
        } catch (error: any) {
            console.error('Erro ao excluir:', error);
            alert(`❌ Erro ao excluir: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setDeleting(false);
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


    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1>🗺️ Gerenciar Zonas de Atendimento</h1>
                    <p>Configure as zonas geográficas baseadas em ranges de CEP</p>
                </div>
                <div className={styles.headerActions}>
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

                <div className={styles.statCard} style={{ borderColor: '#fbbf24', borderWidth: '2px' }}>
                    <div className={styles.statIcon} style={{ background: '#fef3c7' }}>
                        <span>⚠️</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Clientes Sem Zona</div>
                        <div className={styles.statValue} style={{ color: '#f59e0b' }}>{clientes.length}</div>
                    </div>
                </div>
            </div>

            {/* Clientes Sem Zona */}
            {clientes.length > 0 && (
                <div className={styles.clientesSemZonaSection}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2>⚠️ Clientes Sem Zona Configurada</h2>
                            <p>Total de {clientes.length} cliente(s) que precisam ser alocados em uma zona</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleExportExcel}
                                disabled={exporting || clientes.length === 0}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: exporting || clientes.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: exporting || clientes.length === 0 ? 0.6 : 1,
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem'
                                }}
                            >
                                {exporting ? '⏳' : '📥'} {exporting ? 'Exportando...' : 'Exportar para Excel'}
                            </button>
                            {selectedClientes.size > 0 && (
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={deleting}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: deleting ? 'not-allowed' : 'pointer',
                                        opacity: deleting ? 0.6 : 1,
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {deleting ? '⏳' : '🗑️'} {deleting ? 'Excluindo...' : `Excluir Selecionados (${selectedClientes.size})`}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className={styles.clientesTableContainer}>
                        <table className={styles.clientesTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedClientes.size === clientes.length && clientes.length > 0}
                                            onChange={handleSelectAll}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </th>
                                    <th>Nome do Cliente</th>
                                    <th>Endereço</th>
                                    <th>Bairro</th>
                                    <th>Cidade/Estado</th>
                                    <th>CEP</th>
                                    <th>Status</th>
                                    <th>Potencial</th>
                                    <th>Executivo</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientes.map((cliente) => (
                                    <tr key={cliente.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedClientes.has(cliente.id)}
                                                onChange={() => handleSelectCliente(cliente.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td>
                                            <strong>{cliente.name}</strong>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--ds-text-muted)' }}>
                                                {cliente.address.street || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.8125rem' }}>
                                                {cliente.address.neighborhood || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.8125rem' }}>
                                                {cliente.address.city || '-'}
                                                {cliente.address.state && `/${cliente.address.state}`}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.8125rem' }}>
                                                {cliente.address.zip ? formatCep(cliente.address.zip) : '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={styles.statusBadge}>
                                                {cliente.status}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={styles.potentialBadge}>
                                                {cliente.salesPotential}
                                            </span>
                                        </td>
                                        <td>
                                            {cliente.seller ? (
                                                <span style={{ fontSize: '0.8125rem' }}>
                                                    {cliente.seller.name}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.8125rem', color: 'var(--ds-text-muted)', fontStyle: 'italic' }}>
                                                    Sem executivo
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <a 
                                                href={`/restaurant/${cliente.id}`}
                                                className={styles.viewButton}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Ver Cliente →
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                            filteredZonas.map((zona) => {
                                // Gerar ID numérico baseado na posição ordenada (1, 2, 3...)
                                // Ordenar por região e depois por nome para IDs consistentes
                                const sortedZonas = [...zonas].sort((a, b) => {
                                    if (a.regiao !== b.regiao) {
                                        return (a.regiao || '').localeCompare(b.regiao || '');
                                    }
                                    return a.zonaNome.localeCompare(b.zonaNome);
                                });
                                const zonaId = sortedZonas.findIndex(z => z.id === zona.id) + 1;
                                return (
                                    <tr key={zona.id}>
                                        <td>
                                            <strong style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 700 }}>#{zonaId}</strong>
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
