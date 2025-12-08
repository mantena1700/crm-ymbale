'use client';

import { useState, useEffect } from 'react';
import { Restaurant, AnalysisResult, Note, Seller, Visit } from '@/lib/types';
import Link from 'next/link';
import styles from './page.module.css';
import AnalysisView from '@/components/AnalysisView';
import NotesSection from '@/components/NotesSection';
import MapsModal from '@/components/MapsModal';
import EmailModal from '@/components/EmailModal';
import VisitModal from './VisitModal';
import { updateRestaurantStatus, updateRestaurantSeller, getVisits } from '@/app/actions';

interface Props {
    restaurant: Restaurant;
    initialAnalysis: AnalysisResult | null;
    initialNotes: Note[];
    sellers: Seller[];
}

export default function RestaurantDetailsClient({ restaurant, initialAnalysis, initialNotes, sellers }: Props) {
    const [isMapsOpen, setIsMapsOpen] = useState(false);
    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const [isVisitOpen, setIsVisitOpen] = useState(false);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loadingVisits, setLoadingVisits] = useState(false);
    const [status, setStatus] = useState(restaurant.status || 'A Analisar');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        loadVisits();
    }, [restaurant.id]);

    const loadVisits = async () => {
        setLoadingVisits(true);
        try {
            const data = await getVisits(restaurant.id);
            setVisits(data);
        } catch (error) {
            console.error('Erro ao carregar visitas:', error);
        } finally {
            setLoadingVisits(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        setIsUpdating(true);
        try {
            await updateRestaurantStatus(restaurant.id, newStatus);
            setStatus(newStatus);
        } catch (error) {
            console.error('Failed to update status:', error);
            alert('Erro ao atualizar status.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSellerChange = async (sellerId: string) => {
        setIsUpdating(true);
        try {
            await updateRestaurantSeller(restaurant.id, sellerId || null);
            // Optimistic update or wait for revalidate
            window.location.reload(); // Simple reload to reflect changes for now
        } catch (error) {
            console.error('Failed to update seller:', error);
            alert('Erro ao atualizar vendedor.');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className={styles.container}>
            <Link href="/pipeline" className={styles.backLink}>
                ← Voltar para Pipeline
            </Link>

            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className={styles.headerContent}>
                    <div className={styles.titleSection}>
                        <div className={styles.titleRow}>
                            <h1>{restaurant.name}</h1>
                            <span className={styles.rating}>{restaurant.rating} ⭐</span>
                        </div>
                        <div className={styles.metaInfo}>
                            <span className={styles.statusBadge}>{status}</span>
                            <span className={styles.separator}>•</span>
                            <span className={styles.category}>{restaurant.category}</span>
                            <span className={styles.separator}>•</span>
                            <span className={styles.location}>{restaurant.address.neighborhood}, {restaurant.address.city} - {restaurant.address.state}</span>
                        </div>
                    </div>
                    <div className={styles.actions}>
                        <button
                            onClick={() => setIsEmailOpen(true)}
                            className={styles.emailButton}
                        >
                            📧 Enviar Email
                        </button>
                        <button
                            onClick={() => handleStatusChange('Qualificado')}
                            disabled={isUpdating || status === 'Qualificado'}
                            className={styles.qualifyButton}
                        >
                            ✅ Qualificar
                        </button>
                        <button
                            onClick={() => handleStatusChange('Descartado')}
                            disabled={isUpdating || status === 'Descartado'}
                            className={styles.discardButton}
                        >
                            ❌ Descartar
                        </button>
                    </div>
                </div>
            </div>

            {/* Seller Assignment Card - Enhanced */}
            <div className={styles.sellerCard}>
                <div className={styles.sellerHeader}>
                    <h3 className={styles.sectionTitle}>👤 Vendedor Responsável</h3>
                    {restaurant.seller && (
                        <button
                            onClick={() => setIsVisitOpen(true)}
                            disabled={!restaurant.seller}
                            className={styles.visitButton}
                        >
                            📅 Registrar Visita
                        </button>
                    )}
                </div>
                <div className={styles.sellerContent}>
                    {restaurant.seller ? (
                        <div className={styles.sellerInfo}>
                            <div className={styles.sellerPhotoContainer}>
                                {restaurant.seller.photoUrl ? (
                                    <img 
                                        src={restaurant.seller.photoUrl} 
                                        alt={restaurant.seller.name}
                                        className={styles.sellerPhotoLarge}
                                    />
                                ) : (
                                    <div className={styles.sellerPhotoPlaceholderLarge}>
                                        {restaurant.seller.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                )}
                                <div className={styles.sellerBadge}>
                                    <span className={styles.sellerName}>{restaurant.seller.name}</span>
                                    {restaurant.seller.regions?.includes(restaurant.address.city) && (
                                        <span className={styles.regionTag}>📍 Área da Cidade</span>
                                    )}
                                    {restaurant.seller.neighborhoods?.includes(restaurant.address.neighborhood) && (
                                        <span className={styles.regionTag}>🏘️ Área do Bairro</span>
                                    )}
                                </div>
                            </div>
                            {restaurant.seller.email && (
                                <p className={styles.sellerContact}>📧 {restaurant.seller.email}</p>
                            )}
                            {restaurant.seller.phone && (
                                <p className={styles.sellerContact}>📱 {restaurant.seller.phone}</p>
                            )}
                            {restaurant.assignedAt && (
                                <p className={styles.assignedDate}>
                                    Atribuído em: {new Date(restaurant.assignedAt).toLocaleDateString('pt-BR')}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className={styles.noSeller}>Nenhum vendedor atribuído</p>
                    )}
                    <div className={styles.sellerSelect}>
                        <label>Alterar Vendedor:</label>
                        <select
                            value={restaurant.seller?.id || ''}
                            onChange={(e) => handleSellerChange(e.target.value)}
                            disabled={isUpdating}
                            className={styles.sellerSelectInput}
                        >
                            <option value="">-- Sem Vendedor --</option>
                            {sellers.map(seller => (
                                <option key={seller.id} value={seller.id}>
                                    {seller.name} 
                                    {seller.neighborhoods?.includes(restaurant.address.neighborhood) ? ' (Bairro)' : ''} 
                                    {seller.regions?.includes(restaurant.address.city) ? ' (Cidade)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Visits History */}
            {restaurant.seller && visits.length > 0 && (
                <div className={styles.visitsCard}>
                    <h3 className={styles.sectionTitle}>📅 Histórico de Visitas</h3>
                    <div className={styles.visitsList}>
                        {visits.map(visit => (
                            <div key={visit.id} className={styles.visitItem}>
                                <div className={styles.visitHeader}>
                                    <span className={styles.visitDate}>
                                        {new Date(visit.visitDate).toLocaleDateString('pt-BR')}
                                    </span>
                                    <span className={`${styles.outcomeBadge} ${styles[`outcome${visit.outcome}`]}`}>
                                        {visit.outcome === 'positive' && '✅ Positivo'}
                                        {visit.outcome === 'neutral' && '➖ Neutro'}
                                        {visit.outcome === 'negative' && '❌ Negativo'}
                                        {visit.outcome === 'scheduled' && '📅 Agendado'}
                                    </span>
                                </div>
                                {visit.feedback && (
                                    <p className={styles.visitFeedback}>{visit.feedback}</p>
                                )}
                                {visit.nextVisitDate && (
                                    <p className={styles.nextVisit}>
                                        Próxima visita: {new Date(visit.nextVisitDate).toLocaleDateString('pt-BR')}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Cards Grid */}
            <div className={styles.infoGrid}>
                <div className={styles.infoCard}>
                    <div className={styles.infoIcon}>💰</div>
                    <div className={styles.infoContent}>
                        <label>Potencial de Vendas</label>
                        <div className={styles.value}>{restaurant.salesPotential}</div>
                    </div>
                </div>
                <div className={styles.infoCard}>
                    <div className={styles.infoIcon}>📦</div>
                    <div className={styles.infoContent}>
                        <label>Projeção de Entregas/Mês</label>
                        <div className={styles.value}>{restaurant.projectedDeliveries.toLocaleString('pt-BR')}</div>
                    </div>
                </div>
                <div className={styles.infoCard}>
                    <div className={styles.infoIcon}>⭐</div>
                    <div className={styles.infoContent}>
                        <label>Total de Avaliações</label>
                        <div className={styles.value}>{restaurant.reviewCount.toLocaleString('pt-BR')}</div>
                    </div>
                </div>
                <div className={styles.infoCard}>
                    <div className={styles.infoIcon}>💬</div>
                    <div className={styles.infoContent}>
                        <label>Total de Comentários</label>
                        <div className={styles.value}>{restaurant.totalComments.toLocaleString('pt-BR')}</div>
                    </div>
                </div>
            </div>

            {/* Address Card */}
            <div className={styles.addressCard}>
                <h3 className={styles.sectionTitle}>📍 Localização</h3>
                <div className={styles.addressContent}>
                    <div className={styles.addressInfo}>
                        <p className={styles.addressLine}>{restaurant.address.street}</p>
                        <p className={styles.addressLine}>{restaurant.address.neighborhood}</p>
                        <p className={styles.addressLine}>CEP: {restaurant.address.zip}</p>
                        <p className={styles.addressLine}>{restaurant.address.city} - {restaurant.address.state}</p>
                    </div>
                    <button
                        onClick={() => setIsMapsOpen(true)}
                        className={styles.mapsButton}
                    >
                        🗺️ Ver no Google Maps
                    </button>
                </div>
            </div>

            {/* Analysis Section */}
            <AnalysisView restaurant={restaurant} initialAnalysis={initialAnalysis} />

            {/* Notes Section */}
            <NotesSection restaurantId={restaurant.id} initialNotes={initialNotes} />

            <MapsModal
                isOpen={isMapsOpen}
                onClose={() => setIsMapsOpen(false)}
                query={`${restaurant.name} ${restaurant.address.street} ${restaurant.address.city}`}
                restaurant={restaurant}
            />

            <EmailModal
                isOpen={isEmailOpen}
                onClose={() => setIsEmailOpen(false)}
                restaurant={restaurant}
                analysis={initialAnalysis}
            />

            {restaurant.seller && (
                <VisitModal
                    isOpen={isVisitOpen}
                    onClose={() => setIsVisitOpen(false)}
                    restaurantId={restaurant.id}
                    restaurantName={restaurant.name}
                    sellerId={restaurant.seller.id}
                    sellerName={restaurant.seller.name}
                    onVisitCreated={() => {
                        loadVisits();
                        setIsVisitOpen(false);
                    }}
                />
            )}
        </div>
    );
}
