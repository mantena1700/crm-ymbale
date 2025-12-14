'use client';

import { useState } from 'react';
import { createSeller, updateSeller, deleteSeller } from './actions';
import { syncRestaurantsWithSellers } from '@/app/actions';
import PhotoUpload from '@/components/PhotoUpload';
import TerritoryMapConfig from '@/components/TerritoryMapConfig';
import MultiTerritoryMapConfig from '@/components/MultiTerritoryMapConfig';
import styles from './page.module.css';

interface Zona {
    id: string;
    zonaNome: string;
    cepInicial: string;
    cepFinal: string;
    regiao?: string;
}

interface Area {
    id: string;
    cidade: string;
    latitude: number;
    longitude: number;
    raioKm: number;
}

interface Seller {
    id: string;
    name: string;
    email: string;
    phone: string;
    photoUrl?: string;
    zonasIds: string[];
    active: boolean;
    territorioTipo?: string | null;
    baseCidade?: string | null;
    baseLatitude?: number | null;
    baseLongitude?: number | null;
    raioKm?: number | null;
    territorioAtivo?: boolean;
    areasCobertura?: Area[] | null;
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
        active: true,
        territorioTipo: 'raio' as string,
        baseCidade: null as string | null,
        baseLatitude: null as number | null,
        baseLongitude: null as number | null,
        raioKm: 50 as number,
        territorioAtivo: true,
        areasCobertura: [] as Area[]
    });
    const [showTerritoryMap, setShowTerritoryMap] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const activeSellers = sellers.filter(s => s.active);

    const handleOpenModal = (seller?: Seller) => {
        if (seller) {
            // Garantir que zonasIds é sempre um array
            setEditingSeller(seller);
            const areas = seller.areasCobertura && Array.isArray(seller.areasCobertura) 
                ? seller.areasCobertura 
                : (seller.baseCidade && seller.baseLatitude && seller.baseLongitude
                    ? [{
                        id: '1',
                        cidade: seller.baseCidade,
                        latitude: seller.baseLatitude,
                        longitude: seller.baseLongitude,
                        raioKm: seller.raioKm || 50
                    }]
                    : []);
            setFormData({
                name: seller.name,
                email: seller.email,
                phone: seller.phone,
                zonasIds: [], // Não usar mais zonas
                active: seller.active,
                territorioTipo: seller.territorioTipo || 'raio',
                baseCidade: seller.baseCidade || null,
                baseLatitude: seller.baseLatitude || null,
                baseLongitude: seller.baseLongitude || null,
                raioKm: seller.raioKm || 50,
                territorioAtivo: seller.territorioAtivo !== undefined ? seller.territorioAtivo : true,
                areasCobertura: areas
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
                active: true,
                territorioTipo: 'raio',
                baseCidade: null,
                baseLatitude: null,
                baseLongitude: null,
                raioKm: 50,
                territorioAtivo: true,
                areasCobertura: []
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
            active: true,
            territorioTipo: 'raio',
            baseCidade: null,
            baseLatitude: null,
            baseLongitude: null,
            raioKm: 50,
            territorioAtivo: true
        });
        setPhotoPreview(null);
        setPhotoFile(null);
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

            // Se usar múltiplas áreas, usar a primeira como base (compatibilidade)
            const firstArea = formData.areasCobertura && formData.areasCobertura.length > 0 
                ? formData.areasCobertura[0] 
                : null;

            const sellerData = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                zonasIds: [], // Não usar mais zonas
                active: formData.active,
                photoUrl,
                territorioTipo: formData.territorioTipo,
                baseCidade: firstArea?.cidade || formData.baseCidade || undefined,
                baseLatitude: firstArea?.latitude || formData.baseLatitude || undefined,
                baseLongitude: firstArea?.longitude || formData.baseLongitude || undefined,
                raioKm: firstArea?.raioKm || formData.raioKm,
                territorioAtivo: formData.territorioAtivo,
                areasCobertura: formData.areasCobertura.length > 0 ? formData.areasCobertura : undefined
            };

            if (editingSeller) {
                const updated = await updateSeller(editingSeller.id, sellerData);
                setSellers(prev => prev.map(s => s.id === updated.id ? {
                    ...s,
                    ...updated,
                    zonasIds: [], // Não usar mais zonas
                    active: updated.active || false,
                    territorioTipo: updated.territorioTipo || 'raio',
                    baseCidade: updated.baseCidade,
                    baseLatitude: updated.baseLatitude,
                    baseLongitude: updated.baseLongitude,
                    raioKm: updated.raioKm,
                    territorioAtivo: updated.territorioAtivo
                } : s));
                // Recarregar a página para garantir que os dados estão atualizados
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                const created = await createSeller(sellerData);
                setSellers(prev => [{
                    ...created,
                    zonasIds: [], // Não usar mais zonas
                    active: created.active || false,
                    territorioTipo: created.territorioTipo || 'raio',
                    baseCidade: created.baseCidade,
                    baseLatitude: created.baseLatitude,
                    baseLongitude: created.baseLongitude,
                    raioKm: created.raioKm,
                    territorioAtivo: created.territorioAtivo
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
        if (!confirm('Deseja sincronizar todos os restaurantes com os executivos baseado nas áreas de cobertura?\n\nIsso irá atribuir automaticamente os restaurantes aos executivos que cobrem suas áreas geográficas.')) {
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
                        <div className={styles.statLabel}>Áreas Configuradas</div>
                        <div className={styles.statValue}>
                            {sellers.reduce((acc, s) => {
                                const areas = s.areasCobertura && Array.isArray(s.areasCobertura) ? s.areasCobertura.length : 0;
                                return acc + areas;
                            }, 0)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Executivos */}
            <div className={styles.grid}>
                {sellers.map(seller => {
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
                                
                                {seller.areasCobertura && Array.isArray(seller.areasCobertura) && seller.areasCobertura.length > 0 && (
                                    <div className={styles.regions}>
                                        <div className={styles.regionsLabel}>Áreas de Cobertura:</div>
                                        <div className={styles.regionTags}>
                                            {seller.areasCobertura.slice(0, 3).map((area: any, index: number) => (
                                                <span key={area.id || index} className={styles.regionTag}>
                                                    📍 {area.cidade} ({area.raioKm}km)
                                                </span>
                                            ))}
                                            {seller.areasCobertura.length > 3 && (
                                                <span className={styles.tagMore}>+{seller.areasCobertura.length - 3} áreas</span>
                                            )}
                                        </div>
                                    </div>
                                )}
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

                            {/* Configuração de Território Geográfico */}
                            <div className={styles.formGroup}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ fontWeight: '600', fontSize: '1rem' }}>🗺️ Áreas de Cobertura</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowTerritoryMap(!showTerritoryMap)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: showTerritoryMap ? '#3498db' : '#e5e7eb',
                                            color: showTerritoryMap ? 'white' : '#374151',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            fontWeight: '500'
                                        }}
                                    >
                                        {showTerritoryMap ? '👁️ Ocultar Mapa' : '🗺️ Configurar no Mapa'}
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                                    Configure múltiplas áreas de cobertura no mapa. Adicione quantas cidades quiser (ex: Sorocaba, Campinas, etc.)
                                </p>
                                
                                {showTerritoryMap && (
                                    <MultiTerritoryMapConfig
                                        areas={formData.areasCobertura}
                                        onAreasChange={(areas) => {
                                            setFormData({
                                                ...formData,
                                                areasCobertura: areas,
                                                // Atualizar campos de compatibilidade com a primeira área
                                                baseCidade: areas.length > 0 ? areas[0].cidade : null,
                                                baseLatitude: areas.length > 0 ? areas[0].latitude : null,
                                                baseLongitude: areas.length > 0 ? areas[0].longitude : null,
                                                raioKm: areas.length > 0 ? areas[0].raioKm : 50
                                            });
                                        }}
                                    />
                                )}

                                {!showTerritoryMap && formData.areasCobertura && formData.areasCobertura.length > 0 && (
                                    <div style={{
                                        padding: '1rem',
                                        background: '#f0f9ff',
                                        borderRadius: '8px',
                                        border: '1px solid #bae6fd'
                                    }}>
                                        <p style={{ margin: 0, fontWeight: '500', marginBottom: '0.5rem' }}>
                                            📍 {formData.areasCobertura.length} Área(s) Configurada(s):
                                        </p>
                                        {formData.areasCobertura.map((area, index) => (
                                            <p key={area.id} style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                                                {index + 1}. {area.cidade} - Raio: {area.raioKm}km
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {!showTerritoryMap && (!formData.areasCobertura || formData.areasCobertura.length === 0) && formData.baseCidade && (
                                    <div style={{
                                        padding: '1rem',
                                        background: '#f0f9ff',
                                        borderRadius: '8px',
                                        border: '1px solid #bae6fd'
                                    }}>
                                        <p style={{ margin: 0, fontWeight: '500' }}>
                                            📍 Base: {formData.baseCidade}
                                        </p>
                                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                                            Raio: {formData.raioKm}km
                                            {formData.baseLatitude && formData.baseLongitude && (
                                                <> • Coordenadas: {formData.baseLatitude.toFixed(4)}, {formData.baseLongitude.toFixed(4)}</>
                                            )}
                                        </p>
                                    </div>
                                )}
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
