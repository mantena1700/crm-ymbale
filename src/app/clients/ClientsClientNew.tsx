'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Restaurant } from '@/lib/types';
import { PageLayout, Card, Grid, Badge, Button } from '@/components/PageLayout';
import { Table } from '@/components/Table';
import { updateRestaurantStatus, allocateRestaurantsToZones } from '@/app/actions';
import styles from './ClientsNew.module.css';

interface Seller {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
}

interface Props {
    initialRestaurants: Restaurant[];
    availableSellers: Seller[];
}

export default function ClientsClientNew({ initialRestaurants, availableSellers = [] }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCity, setSelectedCity] = useState('Todos');
    const [selectedNeighborhood, setSelectedNeighborhood] = useState('Todos');
    const [selectedStatus, setSelectedStatus] = useState('Todos');
    const [selectedPotential, setSelectedPotential] = useState('Todos');
    const [selectedSeller, setSelectedSeller] = useState('Todos');
    const [sortOption, setSortOption] = useState('default');
    const [restaurants, setRestaurants] = useState(initialRestaurants);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [activeTab, setActiveTab] = useState<'active' | 'discarded'>('active');
    const [allocating, setAllocating] = useState(false);

    // Extract unique values for filters
    const cities = useMemo(() => {
        const unique = new Set(restaurants.map(r => r.address?.city || 'Outros').filter(c => c));
        return ['Todos', ...Array.from(unique).sort()];
    }, [restaurants]);

    const neighborhoods = useMemo(() => {
        const unique = new Set(
            restaurants
                .map(r => r.address?.neighborhood || 'Outros')
                .filter(n => n && n !== 'undefined' && n.trim() !== '' && n !== 'Outros')
        );
        return ['Todos', ...Array.from(unique).sort()];
    }, [restaurants]);

    const statuses = ['Todos', 'A Analisar', 'Qualificado', 'Contatado', 'Negociação', 'Fechado'];
    const potentials = ['Todos', 'ALTÍSSIMO', 'ALTO', 'MÉDIO', 'BAIXO'];
    
    // Calcular contagem de leads por executivo
    const sellerCounts = useMemo(() => {
        const counts = new Map<string, number>();
        restaurants.forEach(r => {
            if (r.seller?.name) {
                counts.set(r.seller.name, (counts.get(r.seller.name) || 0) + 1);
            }
        });
        return counts;
    }, [restaurants]);
    
    // Contar leads sem executivo
    const withoutSellerCount = useMemo(() => {
        return restaurants.filter(r => !r.seller).length;
    }, [restaurants]);
    
    // Opções de executivos: Todos + lista de executivos + "Sem Executivo" se houver restaurantes sem executivo
    const hasRestaurantsWithoutSeller = restaurants.some(r => !r.seller);
    // Criar array de opções com IDs únicos para evitar chaves duplicadas
    const sellersOptions = [
        { value: 'Todos', label: 'Todos', id: 'todos' },
        ...(availableSellers || []).map(s => ({ 
            value: s.name, 
            label: `${s.name} (${sellerCounts.get(s.name) || 0})`, 
            id: s.id 
        })),
        ...(hasRestaurantsWithoutSeller ? [{ 
            value: 'Sem Executivo', 
            label: `Sem Executivo (${withoutSellerCount})`, 
            id: 'sem-executivo' 
        }] : [])
    ];

    const filteredRestaurants = useMemo(() => {
        return restaurants.filter(r => {
            // Filter by View Mode
            if (activeTab === 'active' && r.status === 'Descartado') return false;
            if (activeTab === 'discarded' && r.status !== 'Descartado') return false;

            const sellerName = r.seller?.name || '';
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.address?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                (r.address?.neighborhood?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                sellerName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCity = selectedCity === 'Todos' || (r.address?.city || 'Outros') === selectedCity;
            const matchesNeighborhood = selectedNeighborhood === 'Todos' || 
                (r.address?.neighborhood || 'Outros') === selectedNeighborhood;
            const matchesStatus = selectedStatus === 'Todos' || (r.status || 'A Analisar') === selectedStatus;
            const matchesPotential = selectedPotential === 'Todos' || r.salesPotential === selectedPotential;
            // Filtro de executivo: comparar o nome do executivo
            const matchesSeller = selectedSeller === 'Todos' || 
                (sellerName && sellerName === selectedSeller) ||
                (!sellerName && selectedSeller === 'Sem Executivo');

            return matchesSearch && matchesCity && matchesNeighborhood && matchesStatus && matchesPotential && matchesSeller;
        }).sort((a, b) => {
            if (sortOption === 'name') return a.name.localeCompare(b.name);
            if (sortOption === 'rating-high') return b.rating - a.rating;
            if (sortOption === 'rating-low') return a.rating - b.rating;
            if (sortOption === 'reviews-high') return (b.reviewCount || 0) - (a.reviewCount || 0);
            if (sortOption === 'reviews-low') return (a.reviewCount || 0) - (b.reviewCount || 0);
            return 0;
        });
    }, [restaurants, searchTerm, selectedCity, selectedNeighborhood, selectedStatus, selectedPotential, selectedSeller, sortOption, activeTab]);

    // Calculate stats
    const stats = useMemo(() => {
        const active = restaurants.filter(r => r && r.status !== 'Descartado');
        return {
            total: active.length,
            altissimo: active.filter(r => r?.salesPotential === 'ALTÍSSIMO').length,
            alto: active.filter(r => r?.salesPotential === 'ALTO').length,
            medio: active.filter(r => r?.salesPotential === 'MÉDIO').length,
            avgRating: active.length > 0 
                ? (active.reduce((sum, r) => {
                    const rating = r?.rating != null && !isNaN(Number(r.rating)) ? Number(r.rating) : 0;
                    return sum + rating;
                }, 0) / active.length).toFixed(1)
                : '0'
        };
    }, [restaurants]);

    // Table columns
    const tableColumns = [
        {
            key: 'name',
            label: 'Restaurante',
            render: (value: string, row: Restaurant) => (
                <div className={styles.restaurantCell}>
                    <span className={styles.restaurantName}>{value}</span>
                    <span className={styles.restaurantLocation}>{row.address?.neighborhood || 'N/A'}</span>
                </div>
            )
        },
        {
            key: 'address',
            label: 'Localização',
            width: '150px',
            render: (value: any) => value?.city || 'N/A'
        },
        {
            key: 'seller',
            label: 'Executivo',
            width: '150px',
            render: (value: any) => {
                const sellerName = value?.name;
                return sellerName ? <Badge variant="info">{sellerName}</Badge> : <span style={{ color: '#999' }}>Sem Executivo</span>;
            }
        },
        {
            key: 'salesPotential',
            label: 'Potencial',
            width: '120px',
            render: (value: string) => (
                <Badge variant={
                    value === 'ALTÍSSIMO' ? 'danger' : 
                    value === 'ALTO' ? 'warning' : 
                    value === 'MÉDIO' ? 'info' : 'default'
                }>
                    {value}
                </Badge>
            )
        },
        {
            key: 'status',
            label: 'Status',
            width: '120px',
            render: (value: string) => {
                const variant = 
                    value === 'Fechado' ? 'success' :
                    value === 'Negociação' ? 'warning' :
                    value === 'Contatado' ? 'info' : 'default';
                return <Badge variant={variant}>{value || 'A Analisar'}</Badge>;
            }
        },
        {
            key: 'rating',
            label: 'Avaliação',
            width: '100px',
            align: 'center' as const,
            render: (value: number, row: Restaurant) => (
                <div className={styles.ratingCell}>
                    <span>⭐ {value.toFixed(1)}</span>
                    <span className={styles.reviewCount}>({row.reviewCount || 0})</span>
                </div>
            )
        }
    ];

    const getPotentialColor = (potential: string) => {
        switch (potential) {
            case 'ALTÍSSIMO': return '#ef4444';
            case 'ALTO': return '#f59e0b';
            case 'MÉDIO': return '#3b82f6';
            default: return '#94a3b8';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Fechado': return '#22c55e';
            case 'Negociação': return '#f59e0b';
            case 'Contatado': return '#3b82f6';
            case 'Qualificado': return '#10b981';
            default: return '#6366f1';
        }
    };

    const handleAllocateZones = async () => {
        if (!confirm('Deseja alocar todos os restaurantes às suas zonas baseado no CEP?\n\nIsso irá analisar o CEP de cada restaurante e atribuí-lo à zona correspondente.')) {
            return;
        }

        setAllocating(true);
        try {
            const result = await allocateRestaurantsToZones();
            if (result.success) {
                alert(`✅ ${result.message || 'Alocação concluída!'}\n\nRecarregando a página para atualizar os dados...`);
                // Forçar recarregamento completo da página
                window.location.href = window.location.href;
            } else {
                alert(`❌ ${result.message || 'Erro ao alocar restaurantes'}`);
            }
        } catch (error: any) {
            console.error('Erro ao alocar restaurantes:', error);
            alert('❌ Erro ao alocar restaurantes: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setAllocating(false);
        }
    };

    return (
        <PageLayout
            title="Base de Clientes"
            subtitle="Gerencie e segmente seus leads com facilidade"
            icon="👥"
            actions={
                <>
                    <Button 
                        variant="secondary" 
                        onClick={handleAllocateZones}
                        disabled={allocating}
                    >
                        {allocating ? '⏳ Alocando...' : '🗺️ Alocar por CEP'}
                    </Button>
                    <Button variant="secondary" onClick={() => window.location.href = '/batch-analysis'}>
                        🤖 Análise em Lote
                    </Button>
                    <Button variant="primary" onClick={() => window.location.href = '/clients/new'}>
                        ➕ Novo Cliente
                    </Button>
                </>
            }
        >
            {/* Stats Cards */}
            <Grid cols={4}>
                <Card className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        <span>📊</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Total de Leads</div>
                        <div className={styles.statValue}>{stats.total}</div>
                    </div>
                </Card>

                <Card className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                        <span>🔥</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Altíssimo Potencial</div>
                        <div className={styles.statValue}>{stats.altissimo}</div>
                    </div>
                </Card>

                <Card className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        <span>⚡</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Alto Potencial</div>
                        <div className={styles.statValue}>{stats.alto}</div>
                    </div>
                </Card>

                <Card className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                        <span>⭐</span>
                    </div>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Avaliação Média</div>
                        <div className={styles.statValue}>{stats.avgRating}</div>
                    </div>
                </Card>
            </Grid>

            {/* Tabs and Filters */}
            <Card>
                <div className={styles.tabsContainer}>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'active' ? styles.active : ''}`}
                            onClick={() => setActiveTab('active')}
                        >
                            🚀 Ativos ({restaurants.filter(r => r.status !== 'Descartado').length})
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'discarded' ? styles.active : ''}`}
                            onClick={() => setActiveTab('discarded')}
                        >
                            🗑️ Descartados ({restaurants.filter(r => r.status === 'Descartado').length})
                        </button>
                    </div>

                    <div className={styles.viewModeToggle}>
                        <button
                            className={`${styles.viewModeBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Visualização em Grade"
                        >
                            ⊞
                        </button>
                        <button
                            className={`${styles.viewModeBtn} ${viewMode === 'table' ? styles.active : ''}`}
                            onClick={() => setViewMode('table')}
                            title="Visualização em Tabela"
                        >
                            ☰
                        </button>
                    </div>
                </div>

                <div className={styles.filters}>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>🔍 Buscar</label>
                        <input
                            type="text"
                            placeholder="Nome, cidade, bairro ou executivo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                            title="Busque por nome do restaurante, cidade, bairro ou executivo responsável"
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>🏙️ Cidade</label>
                        <select
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre os clientes pela cidade onde estão localizados"
                        >
                            {cities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>📍 Bairro</label>
                        <select
                            value={selectedNeighborhood}
                            onChange={(e) => setSelectedNeighborhood(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre os clientes pelo bairro onde estão localizados"
                        >
                            {neighborhoods.map(neighborhood => (
                                <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>📊 Status</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre pelo status atual do cliente no funil de vendas"
                        >
                            {statuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>🔥 Potencial</label>
                        <select
                            value={selectedPotential}
                            onChange={(e) => setSelectedPotential(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre pelo potencial de vendas do cliente (ALTÍSSIMO, ALTO, MÉDIO, BAIXO)"
                        >
                            {potentials.map(potential => (
                                <option key={potential} value={potential}>{potential}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>👔 Executivo</label>
                        <select
                            value={selectedSeller}
                            onChange={(e) => setSelectedSeller(e.target.value)}
                            className={styles.filterSelect}
                            title="Filtre os clientes pelo executivo responsável pela conta"
                        >
                            {sellersOptions.map(seller => (
                                <option key={seller.id} value={seller.value}>{seller.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>🔀 Ordenar</label>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className={styles.filterSelect}
                            title="Escolha como ordenar a lista de clientes"
                        >
                            <option value="default">Padrão</option>
                            <option value="name">Nome (A-Z)</option>
                            <option value="rating-high">Maior Avaliação</option>
                            <option value="rating-low">Menor Avaliação</option>
                            <option value="reviews-high">Mais Avaliações</option>
                            <option value="reviews-low">Menos Avaliações</option>
                        </select>
                    </div>
                </div>

                <div className={styles.resultsCount}>
                    Mostrando <strong>{filteredRestaurants.length}</strong> de <strong>{restaurants.length}</strong> clientes
                </div>
            </Card>

            {/* Content */}
            {viewMode === 'grid' ? (
                <div className={styles.gridView}>
                    {filteredRestaurants.map(restaurant => (
                        <Card key={restaurant.id} className={styles.restaurantCard}>
                            <div 
                                className={styles.cardHeader}
                                style={{ 
                                    borderLeft: `4px solid ${getPotentialColor(restaurant.salesPotential)}`
                                }}
                            >
                                <h3 className={styles.cardTitle}>{restaurant.name}</h3>
                                <Badge variant={
                                    restaurant.salesPotential === 'ALTÍSSIMO' ? 'danger' : 
                                    restaurant.salesPotential === 'ALTO' ? 'warning' : 
                                    restaurant.salesPotential === 'MÉDIO' ? 'info' : 'default'
                                }>
                                    {restaurant.salesPotential}
                                </Badge>
                            </div>

                            <div className={styles.cardBody}>
                                <div className={styles.cardInfo}>
                                    <span className={styles.infoLabel}>📍</span>
                                    <span>{restaurant.address?.city || 'N/A'}</span>
                                </div>

                                {restaurant.zonaNome && (
                                    <div className={styles.cardInfo}>
                                        <span className={styles.infoLabel}>🗺️</span>
                                        <span>{restaurant.zonaNome}</span>
                                    </div>
                                )}

                                <div className={styles.cardInfo}>
                                    <span className={styles.infoLabel}>⭐</span>
                                    <span>{restaurant.rating.toFixed(1)} ({restaurant.reviewCount || 0} avaliações)</span>
                                </div>

                                <div className={styles.cardInfo}>
                                    <span className={styles.infoLabel}>📊</span>
                                    <Badge variant={
                                        restaurant.status === 'Fechado' ? 'success' :
                                        restaurant.status === 'Negociação' ? 'warning' :
                                        restaurant.status === 'Contatado' ? 'info' : 'default'
                                    }>
                                        {restaurant.status || 'A Analisar'}
                                    </Badge>
                                </div>

                                {restaurant.projectedDeliveries != null && Number(restaurant.projectedDeliveries) > 0 && (
                                    <div className={styles.cardInfo}>
                                        <span className={styles.infoLabel}>📦</span>
                                        <span>{Number(restaurant.projectedDeliveries).toLocaleString('pt-BR')} entregas/dia</span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.cardFooter}>
                                <Button
                                    variant="ghost"
                                    onClick={() => window.location.href = `/restaurant/${restaurant.id}`}
                                    className={styles.cardButton}
                                >
                                    Ver Detalhes →
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <Table
                        columns={tableColumns}
                        data={filteredRestaurants}
                        onRowClick={(row) => window.location.href = `/restaurant/${row.id}`}
                        emptyMessage="Nenhum cliente encontrado"
                    />
                </Card>
            )}
        </PageLayout>
    );
}

