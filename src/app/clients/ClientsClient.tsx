'use client';

import { useState, useMemo } from 'react';
import { Restaurant } from '@/lib/types';
import styles from './page.module.css';
import QuickViewModal from '@/components/QuickViewModal';
import { updateRestaurantStatus } from '@/app/actions';

interface Props {
    initialRestaurants: Restaurant[];
}

export default function ClientsClient({ initialRestaurants }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCity, setSelectedCity] = useState('Todos');
    const [selectedStatus, setSelectedStatus] = useState('Todos');
    const [selectedPotential, setSelectedPotential] = useState('Todos');
    const [sortOption, setSortOption] = useState('default');
    const [quickViewId, setQuickViewId] = useState<string | null>(null);
    const [restaurants, setRestaurants] = useState(initialRestaurants);

    const [viewMode, setViewMode] = useState<'active' | 'discarded'>('active');
    
    const quickViewRestaurant = quickViewId ? restaurants.find(r => r.id === quickViewId) : null;
    
    const handleUpdateStatus = async (id: string, status: string) => {
        await updateRestaurantStatus(id, status);
        setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    };
    
    const handleUpdatePriority = async (id: string, priority: string) => {
        setRestaurants(prev => prev.map(r => r.id === id ? { ...r, salesPotential: priority } : r));
    };

    // Extract unique values for filters
    const cities = useMemo(() => {
        const unique = new Set(restaurants.map(r => r.address.city || 'Outros').filter(c => c));
        return ['Todos', ...Array.from(unique).sort()];
    }, [restaurants]);

    const statuses = ['Todos', 'A Analisar', 'Qualificado', 'Contatado', 'Negociação', 'Fechado'];
    const potentials = ['Todos', 'ALTÍSSIMO', 'ALTO', 'MÉDIO', 'BAIXO'];

    const filteredRestaurants = useMemo(() => {
        return restaurants.filter(r => {
            // Filter by View Mode (Active vs Discarded)
            if (viewMode === 'active' && r.status === 'Descartado') return false;
            if (viewMode === 'discarded' && r.status !== 'Descartado') return false;

            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.category.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCity = selectedCity === 'Todos' || (r.address.city || 'Outros') === selectedCity;
            const matchesStatus = selectedStatus === 'Todos' || (r.status || 'A Analisar') === selectedStatus;
            const matchesPotential = selectedPotential === 'Todos' || r.salesPotential === selectedPotential;

            return matchesSearch && matchesCity && matchesStatus && matchesPotential;
        }).sort((a, b) => {
            if (sortOption === 'reviews-high') {
                return (b.reviewCount || 0) - (a.reviewCount || 0);
            }
            if (sortOption === 'reviews-low') {
                return (a.reviewCount || 0) - (b.reviewCount || 0);
            }
            return 0;
        });
    }, [restaurants, searchTerm, selectedCity, selectedStatus, selectedPotential, sortOption, viewMode]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>👥 Base de Clientes</h1>
                    <p>Gerencie e segmente seus leads com facilidade.</p>
                </div>
                <div className={styles.stats}>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>{filteredRestaurants.length}</span>
                        <span className={styles.statLabel}>
                            {viewMode === 'active' ? 'Clientes Ativos' : 'Clientes Descartados'}
                        </span>
                    </div>
                </div>
            </header>

            <div className={styles.viewToggle}>
                <button
                    className={`${styles.toggleButton} ${viewMode === 'active' ? styles.active : ''}`}
                    onClick={() => setViewMode('active')}
                >
                    🚀 Ativos
                </button>
                <button
                    className={`${styles.toggleButton} ${viewMode === 'discarded' ? styles.active : ''}`}
                    onClick={() => setViewMode('discarded')}
                >
                    🗑️ Descartados
                </button>
            </div>

            <div className={styles.filtersContainer}>
                <div className={styles.filterGroup}>
                    <label>Buscar</label>
                    <div className={styles.searchBox}>
                        <span className={styles.searchIcon}>🔍</span>
                        <input
                            type="text"
                            placeholder="Nome ou categoria..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>

                <div className={styles.filterGroup}>
                    <label>Cidade</label>
                    <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className={styles.select}>
                        {cities.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                </div>

                <div className={styles.filterGroup}>
                    <label>Status</label>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={styles.select}>
                        {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                </div>

                <div className={styles.filterGroup}>
                    <label>Potencial</label>
                    <select value={selectedPotential} onChange={(e) => setSelectedPotential(e.target.value)} className={styles.select}>
                        {potentials.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                <div className={styles.filterGroup}>
                    <label>Ordenação</label>
                    <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className={styles.select}>
                        <option value="default">Padrão</option>
                        <option value="reviews-high">Avaliações (Maior)</option>
                        <option value="reviews-low">Avaliações (Menor)</option>
                    </select>
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Cidade / Bairro</th>
                            <th>Avaliações</th>
                            <th>Potencial</th>
                            <th>Status</th>
                            <th>Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRestaurants.length > 0 ? (
                            filteredRestaurants.map(r => (
                                <tr key={r.id}>
                                    <td>
                                        <div className={styles.nameCell}>
                                            <span className={styles.restaurantName}>{r.name}</span>
                                            {r.category && r.category !== 'N/A' && (
                                                <span className={styles.categoryTag}>{r.category}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.locationCell}>
                                            <span>{r.address.city || 'N/A'}</span>
                                            {r.address.neighborhood && (
                                                <span className={styles.subText}>{r.address.neighborhood}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.ratingCell}>
                                            <span className={styles.star}>⭐ {r.rating.toFixed(1)}</span>
                                            <span className={styles.reviewCount}>{r.reviewCount.toLocaleString('pt-BR')} avaliações</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={
                                            r.salesPotential === 'ALTÍSSIMO' ? styles.badgeHigh :
                                                r.salesPotential === 'ALTO' ? styles.badgeMedium :
                                                    styles.badgeLow
                                        }>
                                            {r.salesPotential}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${styles[r.status?.replace(' ', '') || 'AAnalisar']}`}>
                                            {r.status || 'A Analisar'}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            onClick={() => setQuickViewId(r.id)}
                                            className={styles.actionButton}
                                        >
                                            👁️ Ver
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className={styles.emptyState}>
                                    Nenhum cliente encontrado com os filtros atuais.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Quick View Modal */}
            {quickViewRestaurant && (
                <QuickViewModal
                    restaurant={{
                        id: quickViewRestaurant.id,
                        name: quickViewRestaurant.name,
                        rating: quickViewRestaurant.rating,
                        reviewCount: quickViewRestaurant.reviewCount,
                        category: quickViewRestaurant.category,
                        address: quickViewRestaurant.address,
                        status: quickViewRestaurant.status || 'A Analisar',
                        salesPotential: quickViewRestaurant.salesPotential,
                        projectedDeliveries: quickViewRestaurant.projectedDeliveries
                    }}
                    onClose={() => setQuickViewId(null)}
                    onUpdateStatus={handleUpdateStatus}
                    onUpdatePriority={handleUpdatePriority}
                />
            )}
        </div>
    );
}
