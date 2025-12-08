'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import styles from './CarteiraMap.module.css';

interface Restaurant {
    id: string;
    name: string;
    address: any;
    salesPotential: string | null;
    rating: number;
    status: string;
}

interface CarteiraMapProps {
    restaurants: Restaurant[];
}

interface CachedLocation {
    lat: number;
    lng: number;
    timestamp: number;
}

// Cache de coordenadas (persiste durante a sessão)
const locationCache = new Map<string, CachedLocation>();

// Cores por potencial
const POTENTIAL_COLORS: Record<string, string> = {
    'ALTISSIMO': '#ef4444',
    'ALTO': '#fbbf24',
    'MEDIO': '#3b82f6',
    'BAIXO': '#9ca3af',
};

const getPotentialColor = (potential: string | null | undefined): string => {
    if (!potential) return POTENTIAL_COLORS['BAIXO'];
    const normalized = potential.toUpperCase().trim();
    return POTENTIAL_COLORS[normalized] || POTENTIAL_COLORS['BAIXO'];
};

const buildFullAddress = (restaurant: Restaurant): string => {
    const parts = [];
    if (restaurant.address?.street) parts.push(restaurant.address.street);
    if (restaurant.address?.neighborhood) parts.push(restaurant.address.neighborhood);
    if (restaurant.address?.city) parts.push(restaurant.address.city);
    if (restaurant.address?.state) parts.push(restaurant.address.state);
    return parts.filter(Boolean).join(', ') || restaurant.name;
};

// Calcular distância entre dois pontos (Haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

export default function CarteiraMapIntelligent({ restaurants }: CarteiraMapProps) {
    const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
    const [mapLoaded, setMapLoaded] = useState(false);
    const [isLoadingMap, setIsLoadingMap] = useState(true);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [showRoute, setShowRoute] = useState(false);
    const [routeDistance, setRouteDistance] = useState<string>('');
    const [routeDuration, setRouteDuration] = useState<string>('');
    const [geocodingProgress, setGeocodingProgress] = useState(0);
    const [smartSelectionMode, setSmartSelectionMode] = useState<'closest' | 'potential' | 'mixed'>('mixed');
    
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const geocodedLocations = useRef<Map<string, google.maps.LatLng>>(new Map());

    // Map de restaurantes
    const restaurantMap = useMemo(() => {
        const map = new Map<string, Restaurant>();
        restaurants.forEach(r => map.set(r.id, r));
        return map;
    }, [restaurants]);

    // Estatísticas
    const stats = useMemo(() => ({
        total: restaurants.length,
        altissimo: restaurants.filter(r => r.salesPotential?.toUpperCase() === 'ALTISSIMO').length,
        alto: restaurants.filter(r => r.salesPotential?.toUpperCase() === 'ALTO').length,
        medio: restaurants.filter(r => r.salesPotential?.toUpperCase() === 'MEDIO').length,
        baixo: restaurants.filter(r => !r.salesPotential || r.salesPotential?.toUpperCase() === 'BAIXO').length,
        selected: selectedRestaurants.size,
    }), [restaurants, selectedRestaurants]);

    // Centro do mapa
    const mapCenter = useMemo(() => {
        const cities = restaurants
            .map(r => r.address?.city?.toLowerCase()?.trim())
            .filter(Boolean);
        
        if (cities.length === 0) return { lat: -23.5505, lng: -46.6333 };
        
        const cityCount: Record<string, number> = {};
        cities.forEach(city => {
            if (city) cityCount[city] = (cityCount[city] || 0) + 1;
        });
        
        const mostCommonCity = Object.entries(cityCount)
            .sort((a, b) => b[1] - a[1])[0]?.[0];
        
        const cityCoords: Record<string, { lat: number, lng: number }> = {
            'sorocaba': { lat: -23.5015, lng: -47.4526 },
            'são paulo': { lat: -23.5505, lng: -46.6333 },
            'sao paulo': { lat: -23.5505, lng: -46.6333 },
            'guarulhos': { lat: -23.4543, lng: -46.5339 },
            'campinas': { lat: -22.9099, lng: -47.0626 },
        };
        
        return cityCoords[mostCommonCity] || { lat: -23.5505, lng: -46.6333 };
    }, [restaurants]);

    // Carregar Google Maps usando loader centralizado
    useEffect(() => {
        loadGoogleMaps()
            .then(() => setMapLoaded(true))
            .catch((error) => {
                console.error('Erro ao carregar Google Maps:', error);
                setIsLoadingMap(false);
            });
    }, []);

    // Inicializar mapa
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || googleMapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
            center: mapCenter,
            zoom: 12,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
        });

        googleMapRef.current = map;
        setIsLoadingMap(false);
    }, [mapLoaded, mapCenter]);

    // Geocodificar em batch (paralelo e com cache)
    const geocodeBatch = useCallback(async (restaurantIds: string[]): Promise<Map<string, google.maps.LatLng>> => {
        if (!window.google || !window.google.maps) return new Map();

        setIsGeocoding(true);
        setGeocodingProgress(0);
        
        const results = new Map<string, google.maps.LatLng>();
        const geocoder = new google.maps.Geocoder();
        
        // Processar em paralelo (max 10 por vez para não exceder rate limit)
        const batchSize = 10;
        const batches = [];
        
        for (let i = 0; i < restaurantIds.length; i += batchSize) {
            batches.push(restaurantIds.slice(i, i + batchSize));
        }

        let processed = 0;
        
        for (const batch of batches) {
            const promises = batch.map(async (restaurantId) => {
                const restaurant = restaurantMap.get(restaurantId);
                if (!restaurant) return;

                // Verificar cache primeiro
                const cacheKey = buildFullAddress(restaurant);
                const cached = locationCache.get(cacheKey);
                
                if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
                    const location = new google.maps.LatLng(cached.lat, cached.lng);
                    results.set(restaurantId, location);
                    return;
                }

                // Geocodificar
                try {
                    const result = await geocoder.geocode({ address: cacheKey });
                    
                    if (result.results && result.results[0]) {
                        const location = result.results[0].geometry.location;
                        results.set(restaurantId, location);
                        
                        // Salvar no cache
                        locationCache.set(cacheKey, {
                            lat: location.lat(),
                            lng: location.lng(),
                            timestamp: Date.now()
                        });
                    } else {
                        // Fallback para coordenadas da cidade
                        const city = restaurant.address?.city?.toLowerCase()?.trim();
                        const cityCoords: Record<string, { lat: number, lng: number }> = {
                            'sorocaba': { lat: -23.5015, lng: -47.4526 },
                            'são paulo': { lat: -23.5505, lng: -46.6333 },
                            'sao paulo': { lat: -23.5505, lng: -46.6333 },
                        };
                        
                        const baseCoords = city && cityCoords[city] ? cityCoords[city] : mapCenter;
                        const offset = (Math.random() - 0.5) * 0.02;
                        
                        const location = new google.maps.LatLng(
                            baseCoords.lat + offset,
                            baseCoords.lng + offset
                        );
                        results.set(restaurantId, location);
                    }
                } catch (error) {
                    console.error(`Erro ao geocodificar ${restaurant.name}:`, error);
                }
            });

            await Promise.all(promises);
            processed += batch.length;
            setGeocodingProgress(Math.round((processed / restaurantIds.length) * 100));
        }

        setIsGeocoding(false);
        setGeocodingProgress(0);
        return results;
    }, [restaurantMap, mapCenter]);

    // Atualizar marcadores
    useEffect(() => {
        if (!googleMapRef.current || !mapLoaded) return;

        const updateMarkers = async () => {
            // Limpar marcadores existentes
            markersRef.current.forEach(marker => marker.setMap(null));
            markersRef.current = [];

            const selectedArray = Array.from(selectedRestaurants);
            if (selectedArray.length === 0) return;

            // Geocodificar todos os restaurantes selecionados
            const locations = await geocodeBatch(selectedArray);
            geocodedLocations.current = locations;

            const bounds = new google.maps.LatLngBounds();

            selectedArray.forEach((restaurantId, index) => {
                const restaurant = restaurantMap.get(restaurantId);
                const position = locations.get(restaurantId);
                
                if (!restaurant || !position) return;

                const color = getPotentialColor(restaurant.salesPotential);

                const marker = new google.maps.Marker({
                    position,
                    map: googleMapRef.current,
                    title: restaurant.name,
                    animation: google.maps.Animation.DROP,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 14,
                        fillColor: color,
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 3,
                    },
                    label: {
                        text: (index + 1).toString(),
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                    },
                });

                const fullAddress = buildFullAddress(restaurant);
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="padding: 12px; max-width: 280px; font-family: system-ui;">
                            <strong style="font-size: 15px; color: #1f2937; display: block; margin-bottom: 8px;">${restaurant.name}</strong>
                            <hr style="margin: 8px 0; border: none; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 6px 0; font-size: 13px; color: #4b5563; line-height: 1.4;">📍 ${fullAddress}</p>
                            <p style="margin: 6px 0; font-size: 13px; color: #4b5563;">⭐ Avaliação: ${restaurant.rating?.toFixed(1) || 'N/D'}</p>
                            <p style="margin: 6px 0; font-size: 13px; color: ${color}; font-weight: bold;">🎯 Potencial: ${restaurant.salesPotential || 'N/A'}</p>
                            <p style="margin: 6px 0; font-size: 12px; color: #6b7280;">📋 Status: ${restaurant.status}</p>
                        </div>
                    `,
                });

                marker.addListener('click', () => {
                    infoWindow.open(googleMapRef.current, marker);
                });

                markersRef.current.push(marker);
                bounds.extend(position);
            });

            if (markersRef.current.length > 0) {
                googleMapRef.current?.fitBounds(bounds);
                
                setTimeout(() => {
                    const currentZoom = googleMapRef.current?.getZoom();
                    if (currentZoom && currentZoom > 15) {
                        googleMapRef.current?.setZoom(15);
                    }
                }, 300);
            }
        };

        updateMarkers();
    }, [selectedRestaurants, mapLoaded, restaurantMap, geocodeBatch]);

    // Toggle seleção
    const toggleRestaurant = (restaurantId: string) => {
        setSelectedRestaurants(prev => {
            const newSet = new Set(prev);
            if (newSet.has(restaurantId)) {
                newSet.delete(restaurantId);
            } else {
                if (newSet.size >= 50) {
                    alert('Máximo de 50 restaurantes selecionados');
                    return prev;
                }
                newSet.add(restaurantId);
            }
            return newSet;
        });
    };

    // Seleção inteligente
    const handleSmartSelection = useCallback(async () => {
        let selected: Restaurant[] = [];

        switch (smartSelectionMode) {
            case 'potential':
                // Ordenar por potencial de vendas
                selected = restaurants
                    .sort((a, b) => {
                        const potentialOrder = { ALTISSIMO: 0, ALTO: 1, MEDIO: 2, BAIXO: 3 };
                        const aPotential = potentialOrder[a.salesPotential?.toUpperCase() as keyof typeof potentialOrder] ?? 4;
                        const bPotential = potentialOrder[b.salesPotential?.toUpperCase() as keyof typeof potentialOrder] ?? 4;
                        if (aPotential !== bPotential) return aPotential - bPotential;
                        return (b.rating || 0) - (a.rating || 0);
                    })
                    .slice(0, 20);
                break;

            case 'closest':
                // Ordenar por proximidade do centro
                selected = restaurants
                    .map(r => {
                        const distance = calculateDistance(
                            mapCenter.lat, mapCenter.lng,
                            r.address?.latitude || mapCenter.lat,
                            r.address?.longitude || mapCenter.lng
                        );
                        return { restaurant: r, distance };
                    })
                    .sort((a, b) => a.distance - b.distance)
                    .slice(0, 20)
                    .map(item => item.restaurant);
                break;

            case 'mixed':
            default:
                // Mix inteligente: alto potencial + bem avaliados
                selected = restaurants
                    .map(r => {
                        const potentialScore = {
                            'ALTISSIMO': 100,
                            'ALTO': 75,
                            'MEDIO': 50,
                            'BAIXO': 25
                        }[r.salesPotential?.toUpperCase() || 'BAIXO'] || 0;
                        
                        const ratingScore = (r.rating || 0) * 15;
                        const totalScore = potentialScore + ratingScore;
                        
                        return { restaurant: r, score: totalScore };
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 20)
                    .map(item => item.restaurant);
                break;
        }

        setSelectedRestaurants(new Set(selected.map(r => r.id)));
    }, [restaurants, smartSelectionMode, mapCenter]);

    // Calcular rota otimizada
    const handleCalculateRoute = async () => {
        if (selectedRestaurants.size < 2) {
            alert('Selecione pelo menos 2 restaurantes para calcular a rota.');
            return;
        }

        if (!window.google || !googleMapRef.current) return;

        try {
            const directionsService = new google.maps.DirectionsService();
            
            if (directionsRendererRef.current) {
                directionsRendererRef.current.setMap(null);
            }

            const directionsRenderer = new google.maps.DirectionsRenderer({
                map: googleMapRef.current,
                suppressMarkers: false,
                polylineOptions: {
                    strokeColor: '#6366f1',
                    strokeWeight: 5,
                    strokeOpacity: 0.8,
                }
            });
            directionsRendererRef.current = directionsRenderer;

            const selectedArray = Array.from(selectedRestaurants);
            const waypoints: google.maps.DirectionsWaypoint[] = [];
            
            for (let i = 1; i < Math.min(selectedArray.length - 1, 23); i++) {
                const location = geocodedLocations.current.get(selectedArray[i]);
                if (location) {
                    waypoints.push({ location, stopover: true });
                }
            }

            const origin = geocodedLocations.current.get(selectedArray[0]);
            const destination = geocodedLocations.current.get(selectedArray[selectedArray.length - 1]);

            if (!origin || !destination) {
                alert('Aguarde a geocodificação dos restaurantes.');
                return;
            }

            const result = await directionsService.route({
                origin,
                destination,
                waypoints,
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode.DRIVING,
            });

            directionsRenderer.setDirections(result);
            setShowRoute(true);

            let totalDistance = 0;
            let totalDuration = 0;
            
            result.routes[0].legs.forEach(leg => {
                totalDistance += leg.distance?.value || 0;
                totalDuration += leg.duration?.value || 0;
            });

            setRouteDistance(`${(totalDistance / 1000).toFixed(2)} km`);
            setRouteDuration(`${Math.round(totalDuration / 60)} min`);

        } catch (error) {
            console.error('Erro ao calcular rota:', error);
            alert('Erro ao calcular rota. Tente com menos restaurantes.');
        }
    };

    // Limpar
    const handleClear = () => {
        setSelectedRestaurants(new Set());
        setShowRoute(false);
        if (directionsRendererRef.current) {
            directionsRendererRef.current.setMap(null);
        }
    };

    return (
        <div className={styles.mapSection}>
            {/* Header */}
            <div className={styles.mapHeader}>
                <div>
                    <h2>🗺️ Mapa Inteligente da Região</h2>
                    <p>Geocodificação real • Rotas otimizadas • Seleção inteligente</p>
                </div>
                <div className={styles.mapStats}>
                    <div className={styles.statBadge}>
                        <span>✅</span>
                        <strong>{selectedRestaurants.size}</strong>
                        <span>selecionados</span>
                    </div>
                    <div className={styles.statBadge}>
                        <span>🔥</span>
                        <strong>{stats.altissimo + stats.alto}</strong>
                        <span>alto potencial</span>
                    </div>
                </div>
            </div>

            {/* Controles */}
            <div className={styles.mapControls}>
                <div className={styles.controlsInfo}>
                    <p>💡 <strong>Seleção Inteligente:</strong> Escolha o critério e clique em "Selecionar"</p>
                </div>
                <div className={styles.controlsButtons}>
                    <select 
                        value={smartSelectionMode} 
                        onChange={(e) => setSmartSelectionMode(e.target.value as any)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--card-bg)',
                            color: 'var(--foreground)',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="mixed">🎯 Mix Inteligente (Recomendado)</option>
                        <option value="potential">🔥 Maior Potencial</option>
                        <option value="closest">📍 Mais Próximos</option>
                    </select>
                    
                    <button onClick={handleSmartSelection} className={styles.autoFillBtn}>
                        ⚡ Selecionar Top 20
                    </button>
                    
                    {selectedRestaurants.size >= 2 && (
                        <button onClick={handleCalculateRoute} className={styles.routeBtn}>
                            🚗 Calcular Rota Otimizada
                        </button>
                    )}
                    
                    {selectedRestaurants.size > 0 && (
                        <button onClick={handleClear} className={styles.clearBtn}>
                            🗑️ Limpar
                        </button>
                    )}
                    
                    <div className={styles.routeInfo}>
                        <span>{selectedRestaurants.size} restaurantes</span>
                        {isGeocoding && <span style={{ color: 'var(--warning)' }}> • Geocodificando {geocodingProgress}%</span>}
                        {showRoute && routeDistance && (
                            <span style={{ marginLeft: '1rem', color: 'var(--success)' }}>
                                📏 {routeDistance} • ⏱️ {routeDuration}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.mapContainer}>
                <div className={styles.mapSidebar}>
                    <h3>📋 Restaurantes ({restaurants.length})</h3>
                    <p className={styles.sidebarHint}>Clique para adicionar ao mapa</p>
                    <div className={styles.restaurantList}>
                        {restaurants.slice(0, 100).map(restaurant => {
                            const isSelected = selectedRestaurants.has(restaurant.id);
                            const potentialColor = getPotentialColor(restaurant.salesPotential);
                            
                            return (
                                <div
                                    key={restaurant.id}
                                    className={`${styles.restaurantItem} ${isSelected ? styles.selected : ''}`}
                                    onClick={() => toggleRestaurant(restaurant.id)}
                                    style={{ 
                                        cursor: 'pointer',
                                        borderLeft: `4px solid ${potentialColor}`
                                    }}
                                >
                                    <div className={styles.restaurantHeader}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <strong>{restaurant.name}</strong>
                                    </div>
                                    <div className={styles.restaurantInfo}>
                                        <span>📍 {restaurant.address?.city || 'N/A'}</span>
                                        <span>⭐ {restaurant.rating?.toFixed(1) || 'N/D'}</span>
                                        <span style={{ color: potentialColor, fontWeight: 600 }}>
                                            {restaurant.salesPotential || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.mapWrapper}>
                    <div 
                        ref={mapRef} 
                        style={{ 
                            width: '100%', 
                            height: '700px', 
                            borderRadius: 'var(--radius-lg)',
                            background: '#f3f4f6'
                        }}
                    />
                    {isLoadingMap && (
                        <div className={styles.mapLoadingOverlay}>
                            <span>⏳</span>
                            <p>Carregando Google Maps...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Legenda */}
            <div className={styles.mapLegend}>
                <h3>Legenda</h3>
                <div className={styles.legendGrid}>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: POTENTIAL_COLORS['ALTISSIMO'] }}></span>
                        <div>
                            <strong>🔥 Altíssimo Potencial</strong>
                            <span>{stats.altissimo} restaurantes</span>
                        </div>
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: POTENTIAL_COLORS['ALTO'] }}></span>
                        <div>
                            <strong>⬆️ Alto Potencial</strong>
                            <span>{stats.alto} restaurantes</span>
                        </div>
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: POTENTIAL_COLORS['MEDIO'] }}></span>
                        <div>
                            <strong>➡️ Médio Potencial</strong>
                            <span>{stats.medio} restaurantes</span>
                        </div>
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: POTENTIAL_COLORS['BAIXO'] }}></span>
                        <div>
                            <strong>⬇️ Baixo Potencial</strong>
                            <span>{stats.baixo} restaurantes</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

