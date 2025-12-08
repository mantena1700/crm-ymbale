import Link from 'next/link';
import { Restaurant } from '@/lib/types';
import styles from './RestaurantCard.module.css';

interface RestaurantCardProps {
    restaurant: Restaurant;
}

const RestaurantCard = ({ restaurant }: RestaurantCardProps) => {
    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <h4 className={styles.name}>{restaurant.name}</h4>
                <span className={styles.rating}>{restaurant.rating} ⭐</span>
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
                    {restaurant.projectedDeliveries}
                </p>
            </div>

            <Link href={`/restaurant/${restaurant.id}`} className={styles.button}>
                Ver Análise
            </Link>
        </div>
    );
};

export default RestaurantCard;
