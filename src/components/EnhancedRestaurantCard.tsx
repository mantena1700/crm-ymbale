'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Restaurant } from '@/lib/types';
import { createFollowUp } from '@/app/actions';
import styles from './RestaurantCard.module.css';

interface EnhancedRestaurantCardProps {
    restaurant: Restaurant;
    onFollowUpCreated?: () => void;
}

const EnhancedRestaurantCard = ({ restaurant, onFollowUpCreated }: EnhancedRestaurantCardProps) => {
    const [showActions, setShowActions] = useState(false);
    const [isCreatingFollowUp, setIsCreatingFollowUp] = useState(false);

    const handleQuickEmail = async () => {
        setIsCreatingFollowUp(true);
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            await createFollowUp(
                restaurant.id,
                'email',
                tomorrow.toISOString(),
                `Proposta de Embalagens Premium - ${restaurant.name}`,
                `Olá,\n\nGostaríamos de apresentar nossas embalagens premium que podem resolver os problemas identificados em suas avaliações.\n\nAguardo seu retorno.\n\nAtenciosamente`
            );
            setShowActions(false);
            onFollowUpCreated?.();
        } catch (error) {
            console.error('Error creating follow-up:', error);
        } finally {
            setIsCreatingFollowUp(false);
        }
    };

    return (
        <div 
            className={styles.card}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className={styles.header}>
                <h4 className={styles.name}>{restaurant.name}</h4>
                <span className={styles.rating}>{restaurant.rating.toFixed(1)} ⭐</span>
            </div>

            <div className={styles.details}>
                <p className={styles.detail}>
                    <span className={styles.label}>Potencial:</span>
                    <span className={`${styles.badge} ${styles[restaurant.salesPotential.toLowerCase()] || styles.default}`}>
                        {restaurant.salesPotential}
                    </span>
                </p>
                <p className={styles.detail}>
                    <span className={styles.label}>Entregas:</span>
                    {restaurant.projectedDeliveries.toLocaleString('pt-BR')}/mês
                </p>
                <p className={styles.detail}>
                    <span className={styles.label}>Avaliações:</span>
                    {restaurant.reviewCount.toLocaleString('pt-BR')}
                </p>
            </div>

            {showActions && (
                <div className={styles.quickActions}>
                    <button 
                        onClick={handleQuickEmail}
                        disabled={isCreatingFollowUp}
                        className={styles.quickActionButton}
                        title="Agendar Email"
                    >
                        📧 Email
                    </button>
                    <Link 
                        href={`/restaurant/${restaurant.id}`}
                        className={styles.quickActionButton}
                        title="Ver Detalhes"
                    >
                        👁️ Ver
                    </Link>
                </div>
            )}

            <Link href={`/restaurant/${restaurant.id}`} className={styles.button}>
                Ver Análise Completa
            </Link>
        </div>
    );
};

export default EnhancedRestaurantCard;

