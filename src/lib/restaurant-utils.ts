// Utilitários para normalizar dados de restaurante e evitar erros
import { Restaurant } from './types';

/**
 * Normaliza um restaurante garantindo que todos os campos tenham valores seguros
 */
export function normalizeRestaurant(restaurant: Restaurant | null | undefined): Restaurant | null {
    if (!restaurant) {
        return null;
    }

    // Garantir que address sempre existe e tem estrutura completa
    const rawAddress = restaurant.address || {};
    const safeAddress = {
        street: rawAddress.street || rawAddress.rua || 'Endereço não informado',
        neighborhood: rawAddress.neighborhood || rawAddress.bairro || '',
        city: rawAddress.city || rawAddress.cidade || 'Cidade não informada',
        state: rawAddress.state || rawAddress.estado || 'Estado não informado',
        zip: rawAddress.zip || rawAddress.cep || rawAddress.zipCode || '',
    };

    // Garantir valores numéricos seguros
    const safeRating = restaurant.rating != null && !isNaN(Number(restaurant.rating)) 
        ? Number(restaurant.rating) 
        : 0;
    
    const safeProjectedDeliveries = restaurant.projectedDeliveries != null && !isNaN(Number(restaurant.projectedDeliveries))
        ? Number(restaurant.projectedDeliveries)
        : 0;
    
    const safeReviewCount = restaurant.reviewCount != null && !isNaN(Number(restaurant.reviewCount))
        ? Number(restaurant.reviewCount)
        : 0;
    
    const safeTotalComments = restaurant.totalComments != null && !isNaN(Number(restaurant.totalComments))
        ? Number(restaurant.totalComments)
        : 0;

    return {
        ...restaurant,
        name: restaurant.name || 'Restaurante sem nome',
        rating: safeRating,
        reviewCount: safeReviewCount,
        totalComments: safeTotalComments,
        projectedDeliveries: safeProjectedDeliveries,
        salesPotential: restaurant.salesPotential || 'MÉDIO',
        address: safeAddress,
        status: restaurant.status || 'A Analisar',
        comments: restaurant.comments || [],
        lastCollectionDate: restaurant.lastCollectionDate || '',
    };
}

/**
 * Normaliza um array de restaurantes
 */
export function normalizeRestaurants(restaurants: (Restaurant | null | undefined)[]): Restaurant[] {
    return restaurants
        .map(normalizeRestaurant)
        .filter((r): r is Restaurant => r !== null);
}

/**
 * Formata rating de forma segura
 */
export function formatRating(rating: number | null | undefined): string {
    if (rating == null || isNaN(Number(rating))) {
        return '0.0';
    }
    return Number(rating).toFixed(1);
}

/**
 * Formata número de forma segura
 */
export function formatNumber(value: number | null | undefined, locale: string = 'pt-BR'): string {
    if (value == null || isNaN(Number(value))) {
        return '0';
    }
    return Number(value).toLocaleString(locale);
}

/**
 * Obtém cidade de forma segura
 */
export function getCity(restaurant: Restaurant | null | undefined): string {
    if (!restaurant?.address) {
        return 'Cidade não informada';
    }
    return restaurant.address.city || restaurant.address.cidade || 'Cidade não informada';
}

/**
 * Obtém estado de forma segura
 */
export function getState(restaurant: Restaurant | null | undefined): string {
    if (!restaurant?.address) {
        return 'Estado não informado';
    }
    return restaurant.address.state || restaurant.address.estado || 'Estado não informado';
}

/**
 * Obtém localização completa de forma segura
 */
export function getLocation(restaurant: Restaurant | null | undefined): string {
    if (!restaurant?.address) {
        return 'Localização não informada';
    }
    const city = getCity(restaurant);
    const state = getState(restaurant);
    return `${city}, ${state}`;
}

