'use client';

import { useState } from 'react';
import { createSeller, updateSeller, deleteSeller } from './actions';
import PhotoUpload from '@/components/PhotoUpload';
import styles from './page.module.css';

interface Seller {
    id: string;
    name: string;
    email: string;
    phone: string;
    photoUrl?: string;
    regions: string[];
    neighborhoods: string[];
    active: boolean;
}

interface SellersClientProps {
    initialSellers: Seller[];
}

export default function SellersClient({ initialSellers }: SellersClientProps) {
    const [sellers, setSellers] = useState<Seller[]>(initialSellers);
    const [showModal, setShowModal] = useState(false);
    const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        regions: '',
        neighborhoods: '',
        active: true
    });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleOpenModal = (seller?: Seller) => {
        if (seller) {
            setEditingSeller(seller);
            setFormData({
                name: seller.name,
                email: seller.email,
                phone: seller.phone,
                regions: seller.regions.join(', '),
                neighborhoods: seller.neighborhoods.join(', '),
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
                regions: '',
                neighborhoods: '',
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
            regions: '',
            neighborhoods: '',
            active: true
        });
        setPhotoPreview(null);
        setPhotoFile(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let photoUrl = photoPreview || undefined;

            // Fazer upload da foto se houver arquivo novo
            if (photoFile) {
                try {
                    console.log('📤 Iniciando upload da foto...', photoFile.name, photoFile.size);
                    const uploadFormData = new FormData();
                    uploadFormData.append('photo', photoFile);
                    
                    console.log('📤 Enviando para API /api/sellers/upload...');
                    const response = await fetch('/api/sellers/upload', {
                        method: 'POST',
                        body: uploadFormData,
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Erro ao fazer upload');
                    }
                    
                    const uploadResult = await response.json();
                    console.log('✅ Upload resultado:', uploadResult);
                    
                    if (uploadResult && uploadResult.photoUrl) {
                        photoUrl = uploadResult.photoUrl;
                        console.log('✅ Foto URL obtida:', photoUrl);
                    } else {
                        throw new Error('Upload retornou sem URL da foto');
                    }
                } catch (uploadError: any) {
                    console.error('❌ Erro completo no upload:', uploadError);
                    const errorMessage = uploadError?.message || uploadError?.toString() || 'Erro desconhecido';
                    alert('Erro ao fazer upload da foto:\n\n' + errorMessage + '\n\nVerifique o console para mais detalhes.');
                    setLoading(false);
                    return;
                }
            }

            const regionsArray = formData.regions
                .split(',')
                .map(r => r.trim())
                .filter(r => r.length > 0);

            const neighborhoodsArray = formData.neighborhoods
                .split(',')
                .map(r => r.trim())
                .filter(r => r.length > 0);

            if (editingSeller) {
                const updated = await updateSeller(editingSeller.id, {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    photoUrl: photoUrl,
                    regions: regionsArray,
                    neighborhoods: neighborhoodsArray,
                    active: formData.active
                });
                setSellers(sellers.map(s => s.id === editingSeller.id ? updated : s));
            } else {
                const newSeller = await createSeller({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    photoUrl: photoUrl,
                    regions: regionsArray,
                    neighborhoods: neighborhoodsArray,
                    active: formData.active
                });
                setSellers([...sellers, newSeller]);
            }

            handleCloseModal();
        } catch (error: any) {
            alert('Erro ao salvar vendedor: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este vendedor?')) return;

        try {
            await deleteSeller(id);
            setSellers(sellers.filter(s => s.id !== id));
        } catch (error: any) {
            alert('Erro ao excluir vendedor: ' + error.message);
        }
    };

    const handleToggleActive = async (seller: Seller) => {
        try {
            const updated = await updateSeller(seller.id, {
                ...seller,
                active: !seller.active
            });
            setSellers(sellers.map(s => s.id === seller.id ? updated : s));
        } catch (error: any) {
            alert('Erro ao atualizar vendedor: ' + error.message);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>👥 Gerenciar Vendedores</h1>
                    <p>Configure os vendedores e suas regiões de atuação</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className={styles.addButton}
                >
                    + Novo Vendedor
                </button>
            </header>

            <div className={styles.stats}>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{sellers.length}</span>
                    <span className={styles.statLabel}>Total de Vendedores</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{sellers.filter(s => s.active).length}</span>
                    <span className={styles.statLabel}>Vendedores Ativos</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>
                        {sellers.reduce((acc, s) => acc + s.regions.length, 0)}
                    </span>
                    <span className={styles.statLabel}>Regiões Cobertas</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>
                        {sellers.reduce((acc, s) => acc + (s.neighborhoods?.length || 0), 0)}
                    </span>
                    <span className={styles.statLabel}>Bairros Cobertos</span>
                </div>
            </div>

            <div className={styles.sellersGrid}>
                {sellers.map(seller => (
                    <div key={seller.id} className={`${styles.sellerCard} ${!seller.active ? styles.inactive : ''}`}>
                        <div className={styles.sellerHeader}>
                            <div className={styles.sellerHeaderLeft}>
                                {seller.photoUrl ? (
                                    <img 
                                        src={seller.photoUrl} 
                                        alt={seller.name}
                                        className={styles.sellerPhoto}
                                    />
                                ) : (
                                    <div className={styles.sellerPhotoPlaceholder}>
                                        {seller.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                )}
                                <div>
                                    <h3>{seller.name}</h3>
                                    <span className={`${styles.statusBadge} ${seller.active ? styles.active : styles.inactive}`}>
                                        {seller.active ? '✅ Ativo' : '⏸️ Inativo'}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.sellerActions}>
                                <button
                                    onClick={() => handleToggleActive(seller)}
                                    className={styles.toggleButton}
                                    title={seller.active ? 'Desativar' : 'Ativar'}
                                >
                                    {seller.active ? '⏸️' : '▶️'}
                                </button>
                                <button
                                    onClick={() => handleOpenModal(seller)}
                                    className={styles.editButton}
                                    title="Editar vendedor"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleDelete(seller.id)}
                                    className={styles.deleteButton}
                                    title="Excluir vendedor"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>

                        <div className={styles.sellerInfo}>
                            {seller.email && (
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>📧 Email:</span>
                                    <span>{seller.email}</span>
                                </div>
                            )}
                            {seller.phone && (
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>📞 Telefone:</span>
                                    <span>{seller.phone}</span>
                                </div>
                            )}
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>📍 Regiões:</span>
                                <div className={styles.regionsList}>
                                    {seller.regions.length > 0 ? (
                                        seller.regions.map((region, index) => (
                                            <span key={index} className={styles.regionTag}>
                                                {region}
                                            </span>
                                        ))
                                    ) : (
                                        <span className={styles.noRegions}>Nenhuma região configurada</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>🏘️ Bairros:</span>
                                <div className={styles.regionsList}>
                                    {seller.neighborhoods && seller.neighborhoods.length > 0 ? (
                                        seller.neighborhoods.map((neighborhood, index) => (
                                            <span key={index} className={styles.regionTag} style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                                {neighborhood}
                                            </span>
                                        ))
                                    ) : (
                                        <span className={styles.noRegions}>Nenhum bairro configurado</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {sellers.length === 0 && (
                    <div className={styles.emptyState}>
                        <p>Nenhum vendedor cadastrado</p>
                        <button onClick={() => handleOpenModal()} className={styles.addButton}>
                            + Criar Primeiro Vendedor
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingSeller ? '✏️ Editar Vendedor' : '+ Novo Vendedor'}</h2>
                            <button onClick={handleCloseModal} className={styles.closeButton}>×</button>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <PhotoUpload
                                currentPhotoUrl={photoPreview || undefined}
                                onPhotoChange={(file) => {
                                    setPhotoFile(file);
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setPhotoPreview(reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                    } else {
                                        setPhotoPreview(null);
                                    }
                                }}
                                sellerName={formData.name}
                            />

                            <div className={styles.formGroup}>
                                <label>Nome do Vendedor *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Ex: João Silva"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="vendedor@exemplo.com"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Telefone</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Regiões de Atuação *</label>
                                <input
                                    type="text"
                                    value={formData.regions}
                                    onChange={(e) => setFormData({ ...formData, regions: e.target.value })}
                                    required
                                    placeholder="Sorocaba, Votorantim, Piedade (separadas por vírgula)"
                                />
                                <small>Separe as cidades por vírgula. Ex: Sorocaba, Votorantim, Piedade</small>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Bairros de Atuação</label>
                                <input
                                    type="text"
                                    value={formData.neighborhoods}
                                    onChange={(e) => setFormData({ ...formData, neighborhoods: e.target.value })}
                                    placeholder="Centro, Campolim, Éden (separados por vírgula)"
                                />
                                <small>Separe os bairros por vírgula.</small>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    />
                                    <span>Vendedor ativo</span>
                                </label>
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className={styles.cancelButton}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={styles.saveButton}
                                >
                                    {loading ? 'Salvando...' : editingSeller ? 'Atualizar' : 'Criar Vendedor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

