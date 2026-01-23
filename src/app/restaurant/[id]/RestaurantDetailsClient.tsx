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
    const [status, setStatus] = useState(restaurant?.status || 'A Analisar');
    const [isUpdating, setIsUpdating] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'notes'>('overview');
    const [error, setError] = useState<string | null>(null);

    // Validações para evitar erros com dados faltando
    if (!restaurant) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Restaurante não encontrado</h2>
                <Link href="/pipeline" className={styles.backLink}>
                    ← Voltar para Pipeline
                </Link>
            </div>
        );
    }

    const safeRating = restaurant.rating != null && !isNaN(Number(restaurant.rating)) ? Number(restaurant.rating) : 0;
    const safeAddress = restaurant.address || {
        street: 'Endereço não informado',
        neighborhood: '',
        city: 'Cidade não informada',
        state: 'Estado não informado',
        zip: ''
    };
    const safeProjectedDeliveries = restaurant.projectedDeliveries != null && !isNaN(Number(restaurant.projectedDeliveries)) ? Number(restaurant.projectedDeliveries) : 0;
    const safeReviewCount = restaurant.reviewCount != null && !isNaN(Number(restaurant.reviewCount)) ? Number(restaurant.reviewCount) : 0;
    const safeTotalComments = restaurant.totalComments != null && !isNaN(Number(restaurant.totalComments)) ? Number(restaurant.totalComments) : 0;
    const safeSalesPotential = restaurant.salesPotential || 'MÉDIO';
    const safeName = restaurant.name || 'Restaurante sem nome';

    const loadVisits = async () => {
        if (!restaurant?.id) return;
        setLoadingVisits(true);
        try {
            const data = await getVisits(restaurant.id);
            setVisits(data || []);
        } catch (error) {
            console.error('Erro ao carregar visitas:', error);
            setError('Erro ao carregar visitas');
        } finally {
            setLoadingVisits(false);
        }
    };

    useEffect(() => {
        if (restaurant?.id) {
            loadVisits();
        }
    }, [restaurant?.id]);

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
            window.location.reload();
        } catch (error) {
            console.error('Failed to update seller:', error);
            alert('Erro ao atualizar executivo.');
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusClass = (s: string) => {
        const statusMap: { [key: string]: string } = {
            'A Analisar': styles.statusAAnalisar,
            'Qualificado': styles.statusQualificado,
            'Contatado': styles.statusContatado,
            'Negociação': styles.statusNegociacao,
            'Fechado': styles.statusFechado,
            'Descartado': styles.statusDescartado
        };
        return statusMap[s] || styles.statusAAnalisar;
    };

    const getScoreClass = (potential: string) => {
        switch (potential) {
            case 'ALTÍSSIMO': return styles.altissimo;
            case 'ALTO': return styles.alto;
            case 'MÉDIO': return styles.medio;
            default: return styles.baixo;
        }
    };

    const getNextSteps = () => {
        const steps: string[] = [];

        if (!restaurant.seller) {
            steps.push('Atribuir um executivo responsável');
        }

        if (status === 'A Analisar') {
            steps.push('Analisar perfil com IA para qualificar');
        }

        if (!initialAnalysis) {
            steps.push('Gerar análise de IA');
        }

        if (status === 'Qualificado' && restaurant.seller) {
            steps.push('Agendar primeira visita');
            steps.push('Enviar email de apresentação');
        }

        if (status === 'Contatado') {
            steps.push('Registrar feedback do contato');
            steps.push('Agendar follow-up');
        }

        if (steps.length === 0) {
            steps.push('Lead bem encaminhado! Continue acompanhando');
        }

        return steps.slice(0, 3);
    };

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Erro ao carregar dados</h2>
                <p>{error}</p>
                <Link href="/pipeline" className={styles.backLink}>
                    ← Voltar para Pipeline
                </Link>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Link href="/pipeline" className={styles.backLink}>
                ← Voltar para Pipeline
            </Link>

            {/* Main Content */}
            <div className={styles.mainContent}>
                {/* Header Card - COMPACTO */}
                <div className={styles.headerCard}>
                    <div className={styles.headerLeft}>
                        <div className={styles.restaurantAvatar}>
                            🍽️
                        </div>
                        <div className={styles.headerInfo}>
                            <h1>{safeName}</h1>
                            <div className={styles.headerMeta}>
                                {safeRating > 0 && (
                                    <span className={styles.rating}>
                                        ⭐ {safeRating.toFixed(1)}
                                    </span>
                                )}
                                <span className={`${styles.statusBadge} ${getStatusClass(status)}`}>
                                    {status}
                                </span>
                                {restaurant.analysisStrategy && (
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '100px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        backgroundColor: restaurant.analysisStrategy.includes('DIAMANTE') ? '#3b82f6' :
                                            restaurant.analysisStrategy.includes('OURO') ? '#f59e0b' :
                                                restaurant.analysisStrategy.includes('PRATA') ? '#94a3b8' :
                                                    restaurant.analysisStrategy.includes('BRONZE') ? '#b45309' :
                                                        restaurant.analysisStrategy.includes('VERIFICADO') ? '#10b981' : '#e2e8f0',
                                        color: 'white',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {restaurant.analysisStrategy.includes('DIAMANTE') ? '💎' :
                                            restaurant.analysisStrategy.includes('OURO') ? '🏆' :
                                                restaurant.analysisStrategy.includes('PRATA') ? '🥈' :
                                                    restaurant.analysisStrategy.includes('BRONZE') ? '🥉' : '✅'}
                                        {restaurant.analysisStrategy.split('(')[0].trim()}
                                    </span>
                                )}
                                <span className={styles.location}>
                                    📍 {safeAddress.city}, {safeAddress.state}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        <button onClick={() => setIsEmailOpen(true)} className={`${styles.actionBtn} ${styles.emailButton}`}>
                            📧 Email
                        </button>
                        <button
                            onClick={() => handleStatusChange('Qualificado')}
                            disabled={isUpdating || status === 'Qualificado'}
                            className={`${styles.actionBtn} ${styles.qualifyButton}`}
                        >
                            ✅ Qualificar
                        </button>
                        <button
                            onClick={() => handleStatusChange('Descartado')}
                            disabled={isUpdating || status === 'Descartado'}
                            className={`${styles.actionBtn} ${styles.discardButton}`}
                        >
                            ✕ Descartar
                        </button>
                    </div>
                </div>

                {/* Metrics Grid - COMPACTO */}
                <div className={styles.metricsGrid}>
                    <div className={styles.metricCard}>
                        <div className={`${styles.metricIcon} ${styles.potential}`}>💰</div>
                        <div className={styles.metricContent}>
                            <div className={styles.metricLabel}>Potencial</div>
                            <div className={styles.metricValue}>{safeSalesPotential}</div>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={`${styles.metricIcon} ${styles.deliveries}`}>📦</div>
                        <div className={styles.metricContent}>
                            <div className={styles.metricLabel}>Entregas/Mês</div>
                            <div className={styles.metricValue}>{safeProjectedDeliveries.toLocaleString('pt-BR')}</div>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={`${styles.metricIcon} ${styles.reviews}`}>⭐</div>
                        <div className={styles.metricContent}>
                            <div className={styles.metricLabel}>Avaliações</div>
                            <div className={styles.metricValue}>{safeReviewCount.toLocaleString('pt-BR')}</div>
                        </div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={`${styles.metricIcon} ${styles.comments}`}>💬</div>
                        <div className={styles.metricContent}>
                            <div className={styles.metricLabel}>Comentários</div>
                            <div className={styles.metricValue}>{safeTotalComments.toLocaleString('pt-BR')}</div>
                        </div>
                    </div>
                </div>

                {/* Tabs Container */}
                <div className={styles.tabsContainer}>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            📋 Visão Geral
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'analysis' ? styles.active : ''}`}
                            onClick={() => setActiveTab('analysis')}
                        >
                            🤖 Análise IA
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'notes' ? styles.active : ''}`}
                            onClick={() => setActiveTab('notes')}
                        >
                            📝 Notas ({initialNotes.length})
                        </button>
                    </div>

                    <div className={styles.tabContent}>
                        {activeTab === 'overview' && (
                            <>
                                {/* Address Section */}
                                <div className={styles.addressSection}>
                                    <div className={styles.addressInfo}>
                                        <h4>📍 Localização</h4>
                                        <p className={styles.addressLine}>
                                            {safeAddress.street}<br />
                                            {safeAddress.neighborhood && `${safeAddress.neighborhood} - `}CEP {safeAddress.zip || 'N/A'}<br />
                                            {safeAddress.city} - {safeAddress.state}
                                        </p>
                                    </div>
                                    <button onClick={() => setIsMapsOpen(true)} className={styles.mapsButton}>
                                        🗺️ Ver no Mapa
                                    </button>
                                </div>

                                {/* Score Section */}
                                <div className={styles.scoreSection}>
                                    <div className={`${styles.scoreCircle} ${getScoreClass(safeSalesPotential)}`}>
                                        <span className={styles.scoreValue}>
                                            {safeSalesPotential === 'ALTÍSSIMO' ? '🔥' :
                                                safeSalesPotential === 'ALTO' ? '⚡' :
                                                    safeSalesPotential === 'MÉDIO' ? '📊' : '📉'}
                                        </span>
                                        <span className={styles.scoreLabel}>Score</span>
                                    </div>
                                    <div className={styles.scoreInfo}>
                                        <h4>Potencial: {safeSalesPotential}</h4>
                                        <p>
                                            {safeSalesPotential === 'ALTÍSSIMO' && 'Lead prioritário! Alto volume de avaliações e potencial de conversão elevado.'}
                                            {safeSalesPotential === 'ALTO' && 'Ótima oportunidade. Bom volume de entregas e avaliações positivas.'}
                                            {safeSalesPotential === 'MÉDIO' && 'Oportunidade moderada. Pode ser trabalhado com abordagem personalizada.'}
                                            {safeSalesPotential === 'BAIXO' && 'Lead de menor prioridade. Considere para campanhas em massa.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Summary from Analysis */}
                                {initialAnalysis && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <h4 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--ds-text)' }}>
                                            🎯 Resumo da Análise
                                        </h4>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--ds-text-muted)', lineHeight: '1.6' }}>
                                            {initialAnalysis.summary?.slice(0, 300)}...
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'analysis' && (
                            <AnalysisView restaurant={restaurant} initialAnalysis={initialAnalysis} />
                        )}

                        {activeTab === 'notes' && (
                            <NotesSection restaurantId={restaurant.id} initialNotes={initialNotes} />
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <div className={styles.sidebar}>
                {/* Seller Card - COMPACTO */}
                <div className={styles.sellerCard}>
                    <div className={styles.sellerHeader}>
                        <h3 className={styles.sectionTitle}>👤 Executivo</h3>
                    </div>
                    <div className={styles.sellerContent}>
                        {restaurant.seller ? (
                            <>
                                <div className={styles.sellerInfo}>
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
                                    <div className={styles.sellerDetails}>
                                        <p className={styles.sellerName}>{restaurant.seller.name}</p>
                                        {restaurant.seller.email && (
                                            <p className={styles.sellerContact}>{restaurant.seller.email}</p>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.sellerTags}>
                                    {restaurant.seller.regions?.includes(safeAddress.city) && (
                                        <span className={styles.regionTag}>📍 Área da Cidade</span>
                                    )}
                                    {restaurant.seller.neighborhoods?.includes(safeAddress.neighborhood) && (
                                        <span className={styles.regionTag}>🏘️ Área do Bairro</span>
                                    )}
                                </div>

                                {restaurant.assignedAt && (
                                    <p className={styles.assignedDate}>
                                        Atribuído: {new Date(restaurant.assignedAt).toLocaleDateString('pt-BR')}
                                    </p>
                                )}

                                <button
                                    onClick={() => setIsVisitOpen(true)}
                                    className={styles.visitButton}
                                >
                                    📅 Registrar Visita
                                </button>
                            </>
                        ) : (
                            <p className={styles.noSeller}>Nenhum vendedor atribuído</p>
                        )}

                        <div className={styles.sellerSelect}>
                            <label>Alterar Executivo:</label>
                            <select
                                value={restaurant.seller?.id || ''}
                                onChange={(e) => handleSellerChange(e.target.value)}
                                disabled={isUpdating}
                                className={styles.sellerSelectInput}
                            >
                                <option value="">-- Selecionar --</option>
                                {sellers.map(seller => (
                                    <option key={seller.id} value={seller.id}>
                                        {seller.name}
                                        {seller.neighborhoods?.includes(safeAddress.neighborhood) ? ' (Bairro)' : ''}
                                        {seller.regions?.includes(safeAddress.city) ? ' (Cidade)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Next Steps */}
                <div className={styles.nextSteps}>
                    <h3>💡 Próximos Passos</h3>
                    <div className={styles.nextStepsList}>
                        {getNextSteps().map((step, i) => (
                            <p key={i} className={styles.nextStep}>{step}</p>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className={styles.quickActions}>
                    <h3>⚡ Ações Rápidas</h3>
                    <div className={styles.quickActionsList}>
                        <button className={styles.quickActionBtn} onClick={() => setIsEmailOpen(true)}>
                            📧 Enviar Email
                        </button>
                        <button className={styles.quickActionBtn} onClick={() => setIsMapsOpen(true)}>
                            🗺️ Ver Localização
                        </button>
                        <button className={styles.quickActionBtn} onClick={() => handleStatusChange('Contatado')} disabled={isUpdating}>
                            📞 Marcar como Contatado
                        </button>
                        <button className={styles.quickActionBtn} onClick={() => handleStatusChange('Negociação')} disabled={isUpdating}>
                            🤝 Iniciar Negociação
                        </button>
                    </div>
                </div>

                {/* Visits History */}
                {visits.length > 0 && (
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
                                            {visit.outcome === 'positive' && '✅'}
                                            {visit.outcome === 'neutral' && '➖'}
                                            {visit.outcome === 'negative' && '❌'}
                                            {visit.outcome === 'scheduled' && '📅'}
                                        </span>
                                    </div>
                                    {visit.feedback && (
                                        <p className={styles.visitFeedback}>{visit.feedback}</p>
                                    )}
                                    {visit.nextVisitDate && (
                                        <p className={styles.nextVisit}>
                                            Próxima: {new Date(visit.nextVisitDate).toLocaleDateString('pt-BR')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <MapsModal
                isOpen={isMapsOpen}
                onClose={() => setIsMapsOpen(false)}
                query={`${restaurant.name} ${safeAddress.street} ${safeAddress.city}`}
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
