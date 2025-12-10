'use client';

import { useState } from 'react';
import { createSeller, updateSeller, deleteSeller } from './actions';
import { syncRestaurantsWithSellers } from '@/app/actions';
import PhotoUpload from '@/components/PhotoUpload';
import styles from './page.module.css';

interface Zona {
    id: string;
    zonaNome: string;
    cepInicial: string;
    cepFinal: string;
    regiao?: string;
}

interface Seller {
    id: string;
    name: string;
    email: string;
    phone: string;
    photoUrl?: string;
    zonasIds: string[];
    active: boolean;
}

interface SellersClientProps {
    initialSellers: Seller[];
    availableZonas: Zona[];
}

// Formatar CEP para exibição
function formatCep(cep: string): string {
    const cleaned = cep.replace(/[^0-9]/g, '');
    if (cleaned.length === 8) {
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    return cep;
}

export default function SellersClient({ initialSellers, availableZonas }: SellersClientProps) {
    // Debug: verificar zonas recebidas
    console.log('🔍 SellersClient - Zonas disponíveis recebidas:', {
        total: availableZonas?.length || 0,
        isArray: Array.isArray(availableZonas),
        zonas: availableZonas?.map(z => ({ id: z.id, nome: z.zonaNome })) || []
    });
    
    if (!availableZonas || availableZonas.length === 0) {
        console.warn('⚠️ AVISO: SellersClient recebeu array vazio de zonas. Verifique o seed no servidor.');
    }
    
    const [sellers, setSellers] = useState<Seller[]>(initialSellers);
    const [showModal, setShowModal] = useState(false);
    const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        zonasIds: [] as string[],
        active: true
    });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const activeSellers = sellers.filter(s => s.active);
    const totalZonas = new Set(sellers.flatMap(s => s.zonasIds)).size;

    const handleOpenModal = (seller?: Seller) => {
        if (seller) {
            // Garantir que zonasIds é sempre um array
            const zonasIds = Array.isArray(seller.zonasIds) ? seller.zonasIds : [];
            console.log('Editando executivo:', seller.name, 'Zonas IDs:', zonasIds);
            
            setEditingSeller(seller);
            setFormData({
                name: seller.name,
                email: seller.email,
                phone: seller.phone,
                zonasIds: zonasIds,
                active: seller.active
            });
            setPhotoPreview(seller.photoUrl || null);
            setPhotoFile(null);
        } else {
            setEditingSeller(null);
            setFormData({
                name: '',
                email: '',
                phone: '',
                zonasIds: [],
                active: true
            });
            setPhotoPreview(null);
            setPhotoFile(null);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingSeller(null);
        setFormData({
            name: '',
            email: '',
            phone: '',
            zonasIds: [],
            active: true
        });
        setPhotoPreview(null);
        setPhotoFile(null);
    };

    const handleToggleZona = (zonaId: string) => {
        setFormData(prev => ({
            ...prev,
            zonasIds: prev.zonasIds.includes(zonaId)
                ? prev.zonasIds.filter(id => id !== zonaId)
                : [...prev.zonasIds, zonaId]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let photoUrl = photoPreview || undefined;

            if (photoFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('photo', photoFile);
                
                const response = await fetch('/api/sellers/upload', {
                    method: 'POST',
                    body: uploadFormData,
                });
                
                if (response.ok) {
                    const data = await response.json();
                    photoUrl = data.url;
                }
            }

            const sellerData = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                zonasIds: formData.zonasIds,
                active: formData.active,
                photoUrl
            };

            if (editingSeller) {
                const updated = await updateSeller(editingSeller.id, sellerData);
                setSellers(prev => prev.map(s => s.id === updated.id ? {
                    ...updated,
                    zonasIds: formData.zonasIds
                } : s));
                // Recarregar a página para garantir que os dados estão atualizados
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                const created = await createSeller(sellerData);
                setSellers(prev => [{
                    ...created,
                    zonasIds: formData.zonasIds
                }, ...prev]);
            }

            handleCloseModal();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar executivo');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este executivo?')) return;

        try {
            await deleteSeller(id);
            setSellers(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir executivo');
        }
    };

    const handleSyncRestaurants = async () => {
        if (!confirm('Deseja sincronizar todos os restaurantes com os executivos baseado nas zonas?\n\nIsso irá atribuir automaticamente os restaurantes aos executivos que cobrem suas zonas.')) {
            return;
        }

        setSyncing(true);
        try {
            const result = await syncRestaurantsWithSellers();
            if (result.success) {
                alert(`✅ ${result.message || 'Sincronização concluída!'}`);
                window.location.reload();
            } else {
                alert(`❌ ${result.message || 'Erro ao sincronizar'}`);
            }
        } catch (error: any) {
            console.error('Erro ao sincronizar:', error);
            alert('❌ Erro ao sincronizar restaurantes: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setSyncing(false);
        }
    };

    const getZonaById = (zonaId: string): Zona | undefined => {
        return availableZonas.find(z => z.id === zonaId);
    };

    // Calcular ID numérico para cada zona (baseado na ordem: região -> nome)
    const getZonaNumericId = (zonaId: string): number => {
        const sortedZonas = [...availableZonas].sort((a, b) => {
            if (a.regiao !== b.regiao) {
                return (a.regiao || '').localeCompare(b.regiao || '');
            }
            return a.zonaNome.localeCompare(b.zonaNome);
        });
        return sortedZonas.findIndex(z => z.id === zonaId) + 1;
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1>👔 Gerenciar Executivos</h1>
                    <p>Configure os executivos e suas zonas de atendimento</p>
                </div>
                <div className={styles.headerActions}>
                    <button 
                        className={`${styles.newButton} ${styles.syncButton}`}
                        onClick={handleSyncRestaurants}
                        disabled={syncing}
                    >
                        {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar Restaurantes'}
                    </button>
                    <button className={styles.newButton} onClick={() => handleOpenModal()}>
                        ➕ Novo Executivo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.stats}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#eff6ff' }}>
                        <span>👥</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Total de Executivos</div>
                        <div className={styles.statValue}>{sellers.length}</div>
                    </div>
                </div>
                
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#dcfce7' }}>
                        <span>✅</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Executivos Ativos</div>
                        <div className={styles.statValue}>{activeSellers.length}</div>
                    </div>
                </div>
                
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#fef3c7' }}>
                        <span>🗺️</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Zonas Atendidas</div>
                        <div className={styles.statValue}>{totalZonas}</div>
                    </div>
                </div>
            </div>

            {/* Lista de Executivos */}
            <div className={styles.grid}>
                {sellers.map(seller => {
                    const sellerZonas = seller.zonasIds.map(id => getZonaById(id)).filter(Boolean) as Zona[];
                    return (
                        <div key={seller.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div className={styles.avatar}>
                                    {seller.photoUrl ? (
                                        <img src={seller.photoUrl} alt={seller.name} />
                                    ) : (
                                        <span>{seller.name.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <div className={styles.cardActions}>
                                    <button 
                                        className={styles.btnIcon} 
                                        onClick={() => handleOpenModal(seller)} 
                                        title="Editar"
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        className={`${styles.btnIcon} ${styles.delete}`} 
                                        onClick={() => handleDelete(seller.id)} 
                                        title="Excluir"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            <div className={styles.cardBody}>
                                <h3>{seller.name}</h3>
                                <div className={styles.cardInfo}>
                                    <div className={styles.infoItem}>
                                        <span className={styles.infoIcon}>📧</span>
                                        <span className={styles.infoText}>{seller.email}</span>
                                    </div>
                                    <div className={styles.infoItem}>
                                        <span className={styles.infoIcon}>📱</span>
                                        <span className={styles.infoText}>{seller.phone}</span>
                                    </div>
                                </div>
                                
                                <div className={styles.regions}>
                                    <div className={styles.regionsLabel}>Zonas de Atendimento:</div>
                                    <div className={styles.regionTags}>
                                        {sellerZonas.slice(0, 3).map((zona) => {
                                            const zonaId = getZonaNumericId(zona.id);
                                            return (
                                                <span key={zona.id} className={styles.regionTag}>
                                                    <strong style={{ color: 'var(--primary)', marginRight: '4px' }}>#{zonaId}</strong>
                                                    {zona.zonaNome}
                                                </span>
                                            );
                                        })}
                                        {sellerZonas.length > 3 && (
                                            <span className={styles.tagMore}>+{sellerZonas.length - 3}</span>
                                        )}
                                        {sellerZonas.length === 0 && (
                                            <span className={styles.tagMore}>Nenhuma zona</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className={styles.cardFooter}>
                                <span className={seller.active ? styles.statusActive : styles.statusInactive}>
                                    {seller.active ? '✅ Ativo' : '❌ Inativo'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingSeller ? '✏️ Editar Executivo' : '➕ Novo Executivo'}</h2>
                            <button className={styles.btnClose} onClick={handleCloseModal}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <PhotoUpload
                                currentPhotoUrl={photoPreview}
                                onPhotoChange={(file) => {
                                    setPhotoFile(file);
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => setPhotoPreview(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />

                            <div className={styles.formGroup}>
                                <label>Nome Completo *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    required
                                    placeholder="Ex: João Silva"
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        required
                                        placeholder="exemplo@email.com"
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Telefone *</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        required
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Zonas de Atendimento *</label>
                                <div className={styles.zonasList}>
                                    {availableZonas.length === 0 ? (
                                        <p className={styles.noZonas}>
                                            Nenhuma zona cadastrada. <a href="/admin/zonas" target="_blank">Cadastrar zonas</a>
                                        </p>
                                    ) : (
                                        <>
                                            {formData.zonasIds.length === 0 && availableZonas.length > 0 && (
                                                <p style={{ color: '#f59e0b', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                                    ⚠️ Selecione pelo menos uma zona de atendimento
                                                </p>
                                            )}
                                            {availableZonas.map(zona => {
                                                const zonaId = getZonaNumericId(zona.id);
                                                return (
                                                    <label key={zona.id} className={styles.zonaCheckbox}>
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.zonasIds.includes(zona.id)}
                                                            onChange={() => handleToggleZona(zona.id)}
                                                        />
                                                        <span>
                                                            <strong style={{ color: 'var(--primary)', marginRight: '6px' }}>#{zonaId}</strong>
                                                            {zona.zonaNome} (CEP: {formatCep(zona.cepInicial)} até {formatCep(zona.cepFinal)})
                                                            {zona.regiao && (
                                                                <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                    [{zona.regiao}]
                                                                </span>
                                                            )}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.checkbox}>
                                    <input
                                        type="checkbox"
                                        checked={formData.active}
                                        onChange={e => setFormData({...formData, active: e.target.checked})}
                                    />
                                    <span>Executivo Ativo</span>
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
