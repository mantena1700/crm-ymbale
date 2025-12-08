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

interface RouteSegment {
    from: string;
    to: string;
    distance: number; // km
    duration: number; // minutos
}

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

export default function CarteiraMapAdvanced({ restaurants }: CarteiraMapProps) {
    const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
    const [mapLoaded, setMapLoaded] = useState(false);
    const [isLoadingMap, setIsLoadingMap] = useState(true);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [showRoute, setShowRoute] = useState(false);
    const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
    const [totalDistance, setTotalDistance] = useState<number>(0);
    const [totalDuration, setTotalDuration] = useState<number>(0);
    const [geocodingProgress, setGeocodingProgress] = useState(0);
    
    // Opções avançadas
    const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
    const [showTraffic, setShowTraffic] = useState(false);
    const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT'>('DRIVING');
    const [optimizeRoute, setOptimizeRoute] = useState(true);
    const [avoidHighways, setAvoidHighways] = useState(false);
    const [avoidTolls, setAvoidTolls] = useState(false);
    const [showDistances, setShowDistances] = useState(true);
    const [sortBy, setSortBy] = useState<'distance' | 'potential' | 'manual'>('distance');
    
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
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
            .catch((error) => console.error('Erro ao carregar Google Maps:', error));
    }, []);

    // Inicializar mapa
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || googleMapRef.current) return;

        googleMapRef.current = new google.maps.Map(mapRef.current, {
            center: mapCenter,
            zoom: 13,
            mapTypeId: mapType,
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                }
            ]
        });

        directionsRendererRef.current = new google.maps.DirectionsRenderer({
            map: googleMapRef.current,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#6366f1',
                strokeWeight: 4,
                strokeOpacity: 0.8
            }
        });

        trafficLayerRef.current = new google.maps.TrafficLayer();

        setIsLoadingMap(false);
    }, [mapLoaded, mapCenter, mapType]);

    // Atualizar tipo de mapa
    useEffect(() => {
        if (googleMapRef.current) {
            googleMapRef.current.setMapTypeId(mapType);
        }
    }, [mapType]);

    // Atualizar camada de tráfego
    useEffect(() => {
        if (trafficLayerRef.current && googleMapRef.current) {
            if (showTraffic) {
                trafficLayerRef.current.setMap(googleMapRef.current);
            } else {
                trafficLayerRef.current.setMap(null);
            }
        }
    }, [showTraffic]);

    // Geocodificar endereços
    const geocodeRestaurants = useCallback(async () => {
        if (!mapLoaded || !googleMapRef.current) return;

        setIsGeocoding(true);
        setGeocodingProgress(0);
        
        const geocoder = new google.maps.Geocoder();
        const restaurantsToGeocode = restaurants.filter(r => !geocodedLocations.current.has(r.id));
        
        let processed = 0;
        
        for (const restaurant of restaurantsToGeocode) {
            try {
                const address = buildFullAddress(restaurant);
                const result = await geocoder.geocode({ address });
                
                if (result.results[0]) {
                    geocodedLocations.current.set(restaurant.id, result.results[0].geometry.location);
                }
            } catch (error) {
                console.error(`Erro ao geocodificar ${restaurant.name}:`, error);
            }
            
            processed++;
            setGeocodingProgress(Math.round((processed / restaurantsToGeocode.length) * 100));
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setIsGeocoding(false);
        createMarkers();
    }, [mapLoaded, restaurants]);

    // Criar marcadores
    const createMarkers = useCallback(() => {
        if (!googleMapRef.current) return;

        // Limpar marcadores existentes
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        restaurants.forEach(restaurant => {
            const location = geocodedLocations.current.get(restaurant.id);
            if (!location) return;

            const marker = new google.maps.Marker({
                position: location,
                map: googleMapRef.current!,
                title: restaurant.name,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: getPotentialColor(restaurant.salesPotential),
                    fillOpacity: selectedRestaurants.has(restaurant.id) ? 1 : 0.6,
                    strokeColor: '#fff',
                    strokeWeight: selectedRestaurants.has(restaurant.id) ? 3 : 2,
                },
                zIndex: selectedRestaurants.has(restaurant.id) ? 1000 : 100,
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 8px;">
                        <strong>${restaurant.name}</strong><br>
                        Potencial: ${restaurant.salesPotential || 'N/A'}<br>
                        Avaliação: ${restaurant.rating.toFixed(1)} ⭐
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(googleMapRef.current!, marker);
                toggleRestaurant(restaurant.id);
            });

            markersRef.current.push(marker);
        });
    }, [restaurants, selectedRestaurants]);

    // Calcular e exibir rota otimizada
    const calculateOptimizedRoute = useCallback(async () => {
        if (!googleMapRef.current || selectedRestaurants.size < 2) {
            alert('Selecione pelo menos 2 restaurantes para calcular a rota');
            return;
        }

        setIsGeocoding(true);
        const directionsService = new google.maps.DirectionsService();
        
        const selectedIds = Array.from(selectedRestaurants);
        const waypoints = selectedIds.slice(1, -1).map(id => ({
            location: geocodedLocations.current.get(id)!,
            stopover: true
        }));

        try {
            const result = await directionsService.route({
                origin: geocodedLocations.current.get(selectedIds[0])!,
                destination: geocodedLocations.current.get(selectedIds[selectedIds.length - 1])!,
                waypoints: waypoints,
                optimizeWaypoints: optimizeRoute,
                travelMode: google.maps.TravelMode[travelMode],
                avoidHighways: avoidHighways,
                avoidTolls: avoidTolls,
            });

            if (result.routes[0]) {
                directionsRendererRef.current?.setDirections(result);
                
                // Calcular distância e duração total
                const route = result.routes[0];
                let totalDist = 0;
                let totalTime = 0;
                const segments: RouteSegment[] = [];

                route.legs.forEach((leg, index) => {
                    totalDist += leg.distance?.value || 0;
                    totalTime += leg.duration?.value || 0;
                    
                    const fromId = index === 0 ? selectedIds[0] : selectedIds[index];
                    const toId = index === selectedIds.length - 2 ? selectedIds[selectedIds.length - 1] : selectedIds[index + 1];
                    const fromName = restaurantMap.get(fromId)?.name || 'Ponto';
                    const toName = restaurantMap.get(toId)?.name || 'Ponto';
                    
                    segments.push({
                        from: fromName,
                        to: toName,
                        distance: (leg.distance?.value || 0) / 1000, // metros para km
                        duration: Math.round((leg.duration?.value || 0) / 60) // segundos para minutos
                    });
                });

                setTotalDistance(totalDist / 1000); // metros para km
                setTotalDuration(Math.round(totalTime / 60)); // segundos para minutos
                setRouteSegments(segments);
                setShowRoute(true);
            }
        } catch (error) {
            console.error('Erro ao calcular rota:', error);
            alert('Erro ao calcular rota. Verifique se todos os endereços são válidos.');
        }

        setIsGeocoding(false);
    }, [selectedRestaurants, restaurantMap, travelMode, optimizeRoute, avoidHighways, avoidTolls]);

    // Toggle seleção de restaurante
    const toggleRestaurant = useCallback((id: string) => {
        setSelectedRestaurants(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    // Seleção inteligente por proximidade
    const selectByProximity = useCallback((maxRestaurants: number = 5) => {
        if (geocodedLocations.current.size === 0) return;

        const locations = Array.from(geocodedLocations.current.entries());
        const center = googleMapRef.current?.getCenter();
        if (!center) return;

        const sorted = locations
            .map(([id, loc]) => ({
                id,
                distance: calculateDistance(
                    center.lat(), center.lng(),
                    loc.lat(), loc.lng()
                )
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, maxRestaurants);

        setSelectedRestaurants(new Set(sorted.map(item => item.id)));
    }, []);

    // Seleção por potencial
    const selectByPotential = useCallback((minPotential: 'ALTISSIMO' | 'ALTO' | 'MEDIO' = 'ALTO') => {
        const priorities: Record<string, number> = {
            'ALTISSIMO': 4,
            'ALTO': 3,
            'MEDIO': 2,
            'BAIXO': 1
        };
        
        const threshold = priorities[minPotential];
        const filtered = restaurants
            .filter(r => {
                const potential = r.salesPotential?.toUpperCase() || 'BAIXO';
                return priorities[potential] >= threshold;
            })
            .map(r => r.id);

        setSelectedRestaurants(new Set(filtered));
    }, [restaurants]);

    // Exportar rota
    const exportRoute = useCallback(() => {
        if (routeSegments.length === 0) {
            alert('Calcule uma rota primeiro');
            return;
        }

        const csvContent = [
            ['De', 'Para', 'Distância (km)', 'Tempo (min)'],
            ...routeSegments.map(seg => [
                seg.from,
                seg.to,
                seg.distance.toFixed(2),
                seg.duration.toString()
            ]),
            [],
            ['TOTAL', '', totalDistance.toFixed(2), totalDuration.toString()]
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `rota_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [routeSegments, totalDistance, totalDuration]);

    useEffect(() => {
        if (mapLoaded && restaurants.length > 0) {
            geocodeRestaurants();
        }
    }, [mapLoaded, restaurants, geocodeRestaurants]);

    useEffect(() => {
        createMarkers();
    }, [selectedRestaurants, createMarkers]);

    const getTravelModeIcon = () => {
        switch (travelMode) {
            case 'DRIVING': return '🚗';
            case 'WALKING': return '🚶';
            case 'BICYCLING': return '🚴';
            case 'TRANSIT': return '🚌';
            default: return '🚗';
        }
    };

    return (
        <div className={styles.mapContainer}>
            {/* Controles Avançados */}
            <div className={styles.mapControls}>
                <div className={styles.controlSection}>
                    <h3>🗺️ Opções do Mapa</h3>
                    <div className={styles.controlGrid}>
                        <select value={mapType} onChange={(e) => setMapType(e.target.value as any)}>
                            <option value="roadmap">🗺️ Mapa</option>
                            <option value="satellite">🛰️ Satélite</option>
                            <option value="hybrid">🌐 Híbrido</option>
                            <option value="terrain">⛰️ Terreno</option>
                        </select>
                        
                        <label className={styles.checkbox}>
                            <input 
                                type="checkbox" 
                                checked={showTraffic} 
                                onChange={(e) => setShowTraffic(e.target.checked)}
                            />
                            🚦 Mostrar Tráfego
                        </label>

                        <label className={styles.checkbox}>
                            <input 
                                type="checkbox" 
                                checked={showDistances} 
                                onChange={(e) => setShowDistances(e.target.checked)}
                            />
                            📏 Mostrar Distâncias
                        </label>
                    </div>
                </div>

                <div className={styles.controlSection}>
                    <h3>{getTravelModeIcon()} Modo de Transporte</h3>
                    <div className={styles.controlGrid}>
                        <select value={travelMode} onChange={(e) => setTravelMode(e.target.value as any)}>
                            <option value="DRIVING">🚗 Carro</option>
                            <option value="WALKING">🚶 A pé</option>
                            <option value="BICYCLING">🚴 Bicicleta</option>
                            <option value="TRANSIT">🚌 Transporte Público</option>
                        </select>

                        <label className={styles.checkbox}>
                            <input 
                                type="checkbox" 
                                checked={optimizeRoute} 
                                onChange={(e) => setOptimizeRoute(e.target.checked)}
                            />
                            ⚡ Otimizar Rota
                        </label>

                        <label className={styles.checkbox}>
                            <input 
                                type="checkbox" 
                                checked={avoidHighways} 
                                onChange={(e) => setAvoidHighways(e.target.checked)}
                            />
                            🛣️ Evitar Rodovias
                        </label>

                        <label className={styles.checkbox}>
                            <input 
                                type="checkbox" 
                                checked={avoidTolls} 
                                onChange={(e) => setAvoidTolls(e.target.checked)}
                            />
                            💰 Evitar Pedágios
                        </label>
                    </div>
                </div>

                <div className={styles.controlSection}>
                    <h3>🎯 Seleção Inteligente</h3>
                    <div className={styles.controlGrid}>
                        <button onClick={() => selectByProximity(5)} className={styles.smartBtn}>
                            📍 5 Mais Próximos
                        </button>
                        <button onClick={() => selectByProximity(10)} className={styles.smartBtn}>
                            📍 10 Mais Próximos
                        </button>
                        <button onClick={() => selectByPotential('ALTISSIMO')} className={styles.smartBtn}>
                            🔥 Altíssimo Potencial
                        </button>
                        <button onClick={() => selectByPotential('ALTO')} className={styles.smartBtn}>
                            ⚡ Alto+ Potencial
                        </button>
                        <button onClick={() => setSelectedRestaurants(new Set())} className={styles.smartBtn}>
                            ❌ Limpar Seleção
                        </button>
                        <button onClick={() => setSelectedRestaurants(new Set(restaurants.map(r => r.id)))} className={styles.smartBtn}>
                            ✅ Selecionar Todos
                        </button>
                    </div>
                </div>

                <div className={styles.controlSection}>
                    <h3>📊 Estatísticas</h3>
                    <div className={styles.stats}>
                        <div className={styles.statItem}>
                            <span>Total:</span>
                            <strong>{stats.total}</strong>
                        </div>
                        <div className={styles.statItem}>
                            <span>Selecionados:</span>
                            <strong>{stats.selected}</strong>
                        </div>
                        <div className={styles.statItem}>
                            <span>🔥 Altíssimo:</span>
                            <strong>{stats.altissimo}</strong>
                        </div>
                        <div className={styles.statItem}>
                            <span>⚡ Alto:</span>
                            <strong>{stats.alto}</strong>
                        </div>
                    </div>
                </div>

                <div className={styles.actionButtons}>
                    <button 
                        onClick={calculateOptimizedRoute} 
                        disabled={selectedRestaurants.size < 2 || isGeocoding}
                        className={styles.primaryBtn}
                    >
                        🗺️ Calcular Rota
                    </button>
                    {showRoute && (
                        <button onClick={exportRoute} className={styles.secondaryBtn}>
                            📥 Exportar Rota
                        </button>
                    )}
                </div>
            </div>

            {/* Mapa */}
            <div className={styles.mapWrapper}>
                {isLoadingMap && (
                    <div className={styles.mapLoading}>
                        <div className={styles.spinner}>🗺️</div>
                        <p>Carregando mapa...</p>
                    </div>
                )}
                {isGeocoding && (
                    <div className={styles.geocodingOverlay}>
                        <div className={styles.geocodingProgress}>
                            <p>Processando endereços... {geocodingProgress}%</p>
                            <div className={styles.progressBar}>
                                <div 
                                    className={styles.progressFill} 
                                    style={{ width: `${geocodingProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={mapRef} className={styles.map} />
            </div>

            {/* Informações da Rota */}
            {showRoute && routeSegments.length > 0 && showDistances && (
                <div className={styles.routeInfo}>
                    <div className={styles.routeHeader}>
                        <h3>📊 Detalhes da Rota</h3>
                        <div className={styles.routeTotals}>
                            <div className={styles.totalItem}>
                                <span>📏 Distância Total:</span>
                                <strong>{totalDistance.toFixed(2)} km</strong>
                            </div>
                            <div className={styles.totalItem}>
                                <span>⏱️ Tempo Estimado:</span>
                                <strong>{Math.floor(totalDuration / 60)}h {totalDuration % 60}min</strong>
                            </div>
                            <div className={styles.totalItem}>
                                <span>📍 Paradas:</span>
                                <strong>{routeSegments.length + 1}</strong>
                            </div>
                        </div>
                    </div>

                    <div className={styles.routeSegments}>
                        {routeSegments.map((segment, index) => (
                            <div key={index} className={styles.segment}>
                                <div className={styles.segmentNumber}>{index + 1}</div>
                                <div className={styles.segmentContent}>
                                    <div className={styles.segmentRoute}>
                                        <span className={styles.from}>{segment.from}</span>
                                        <span className={styles.arrow}>→</span>
                                        <span className={styles.to}>{segment.to}</span>
                                    </div>
                                    <div className={styles.segmentMeta}>
                                        <span>📏 {segment.distance.toFixed(2)} km</span>
                                        <span>⏱️ {segment.duration} min</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

