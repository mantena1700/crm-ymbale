'use client';

import { useState } from 'react';
import styles from './ConfirmationModal.module.css';

export type SuggestionType = 'LOW_POTENTIAL' | 'FAR_DISTANCE' | 'NO_NEARBY';

export interface RestaurantSuggestion {
    id: string;
    name: string;
    distance: number;
    durationMinutes?: number;
    potential: string;
    status: string;
    address?: any;
}

// Tipos exportados para uso em outros arquivos
export type SuggestionType = 'LOW_POTENTIAL' | 'FAR_DISTANCE' | 'NO_NEARBY';

export interface RestaurantSuggestion {
    id: string;
    name: string;
    distance: number;
    durationMinutes?: number;
    potential: string;
    status: string;
    address?: any;
}

export interface FillSuggestion {
    id: string;
    type: SuggestionType;
    day: string;
    dayName: string;
    fixedClient: {
        id: string;
        name: string;
        address: any;
        radiusKm: number;
    };
    restaurants: RestaurantSuggestion[];
    message: string;
    details: string;
}

interface ConfirmationModalProps {
    suggestion: FillSuggestion;
    isOpen: boolean;
    onConfirm: (selectedRestaurantIds: string[]) => void;
    onCancel: () => void;
    onSkip: () => void;
}

export default function ConfirmationModal({
    suggestion,
    isOpen,
    onConfirm,
    onCancel,
    onSkip
}: ConfirmationModalProps) {
    const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(
        new Set(suggestion.restaurants.map(r => r.id))
    );

    if (!isOpen) return null;

    const handleToggleRestaurant = (restaurantId: string) => {
        const newSelected = new Set(selectedRestaurants);
        if (newSelected.has(restaurantId)) {
            newSelected.delete(restaurantId);
        } else {
            newSelected.add(restaurantId);
        }
        setSelectedRestaurants(newSelected);
    };

    const handleConfirm = () => {
        if (selectedRestaurants.size === 0) {
            alert('Selecione pelo menos um restaurante para agendar.');
            return;
        }
        onConfirm(Array.from(selectedRestaurants));
    };

    const getTitle = () => {
        switch (suggestion.type) {
            case 'LOW_POTENTIAL':
                return '⚠️ Restaurantes Próximos com Potencial Médio/Baixo';
            case 'FAR_DISTANCE':
                return '📍 Nenhum Restaurante Próximo Encontrado';
            case 'NO_NEARBY':
                return 'ℹ️ Sem Opções de Prospecção';
            default:
                return 'Confirmação Necessária';
        }
    };

    const getIcon = () => {
        switch (suggestion.type) {
            case 'LOW_POTENTIAL':
                return '⚠️';
            case 'FAR_DISTANCE':
                return '📍';
            case 'NO_NEARBY':
                return 'ℹ️';
            default:
                return '❓';
        }
    };

    const getPotentialBadge = (potential: string) => {
        const potentialUpper = potential?.toUpperCase() || 'BAIXO';
        const colors: Record<string, { bg: string; text: string }> = {
            'ALTISSIMO': { bg: '#10b981', text: '#ffffff' },
            'ALTO': { bg: '#3b82f6', text: '#ffffff' },
            'MEDIO': { bg: '#f59e0b', text: '#ffffff' },
            'BAIXO': { bg: '#6b7280', text: '#ffffff' }
        };
        const color = colors[potentialUpper] || colors['BAIXO'];
        return (
            <span
                style={{
                    backgroundColor: color.bg,
                    color: color.text,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                }}
            >
                {potentialUpper}
            </span>
        );
    };

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.icon}>{getIcon()}</div>
                    <h2 className={styles.title}>{getTitle()}</h2>
                    <button className={styles.closeButton} onClick={onCancel}>
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.message}>
                        <p>{suggestion.message}</p>
                        {suggestion.details && (
                            <p className={styles.details}>{suggestion.details}</p>
                        )}
                    </div>

                    {suggestion.type === 'NO_NEARBY' ? (
                        <div className={styles.infoBox}>
                            <p>Não há restaurantes disponíveis para prospecção próximos ao cliente fixo <strong>{suggestion.fixedClient.name}</strong> em <strong>{suggestion.dayName}</strong>.</p>
                            <p>Este slot permanecerá vazio.</p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.fixedClientInfo}>
                                <h3>Cliente Fixo:</h3>
                                <p><strong>{suggestion.fixedClient.name}</strong></p>
                                <p className={styles.address}>
                                    {suggestion.fixedClient.address?.street && (
                                        <>
                                            {suggestion.fixedClient.address.street}
                                            {suggestion.fixedClient.address.number && `, ${suggestion.fixedClient.address.number}`}
                                            <br />
                                        </>
                                    )}
                                    {suggestion.fixedClient.address?.neighborhood && (
                                        <>
                                            {suggestion.fixedClient.address.neighborhood}
                                            {suggestion.fixedClient.address.city && ` - ${suggestion.fixedClient.address.city}`}
                                        </>
                                    )}
                                </p>
                                <p className={styles.radius}>
                                    Raio de busca: <strong>{suggestion.fixedClient.radiusKm}km</strong>
                                </p>
                            </div>

                            <div className={styles.restaurantsList}>
                                <h3>
                                    {suggestion.type === 'LOW_POTENTIAL'
                                        ? 'Restaurantes Encontrados:'
                                        : 'Restaurantes Mais Próximos (fora do raio):'}
                                </h3>
                                <div className={styles.restaurantsGrid}>
                                    {suggestion.restaurants.map((restaurant) => (
                                        <div
                                            key={restaurant.id}
                                            className={`${styles.restaurantCard} ${
                                                selectedRestaurants.has(restaurant.id) ? styles.selected : ''
                                            }`}
                                            onClick={() => handleToggleRestaurant(restaurant.id)}
                                        >
                                            <div className={styles.restaurantHeader}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRestaurants.has(restaurant.id)}
                                                    onChange={() => handleToggleRestaurant(restaurant.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className={styles.restaurantName}>{restaurant.name}</span>
                                            </div>
                                            <div className={styles.restaurantDetails}>
                                                <div className={styles.distanceInfo}>
                                                    <span>📍 {restaurant.distance.toFixed(2)}km</span>
                                                    {restaurant.durationMinutes && (
                                                        <span>⏱️ {restaurant.durationMinutes}min</span>
                                                    )}
                                                </div>
                                                <div className={styles.potentialInfo}>
                                                    {getPotentialBadge(restaurant.potential)}
                                                    <span className={styles.status}>{restaurant.status}</span>
                                                </div>
                                                {restaurant.address?.neighborhood && (
                                                    <div className={styles.neighborhood}>
                                                        {restaurant.address.neighborhood}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    {suggestion.type === 'NO_NEARBY' ? (
                        <button className={styles.confirmButton} onClick={onCancel}>
                            Entendi
                        </button>
                    ) : (
                        <>
                            <button className={styles.skipButton} onClick={onSkip}>
                                Pular e Tentar Próximo
                            </button>
                            <div className={styles.actionButtons}>
                                <button className={styles.cancelButton} onClick={onCancel}>
                                    Cancelar
                                </button>
                                <button
                                    className={styles.confirmButton}
                                    onClick={handleConfirm}
                                    disabled={selectedRestaurants.size === 0}
                                >
                                    Agendar {selectedRestaurants.size > 0 && `(${selectedRestaurants.size})`}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

