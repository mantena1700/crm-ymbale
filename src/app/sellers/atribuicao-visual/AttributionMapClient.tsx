'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import styles from './AttributionMapClient.module.css';

interface Seller {
    id: string;
    name: string;
    baseCidade: string | null;
    baseLatitude: number | null;
    baseLongitude: number | null;
    raioKm: number | null;
    territorioAtivo: boolean;
}

interface Restaurant {
    id: string;
    name: string;
    address: any;
    latitude: number | null;
    longitude: number | null;
    sellerId: string | null;
    status: string | null;
    salesPotential: string | null;
}

interface Props {
    sellers: Seller[];
    restaurants: Restaurant[];
}

declare global {
    interface Window {
        google: any;
    }
}

export default function AttributionMapClient({ sellers, restaurants }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [markers, setMarkers] = useState<any[]>([]);
    const [sellerCircles, setSellerCircles] = useState<any[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPotential, setFilterPotential] = useState<string>('all');

    // Carregar Google Maps
    useEffect(() => {
        const loadMap = async () => {
            try {
                const response = await fetch('/api/google-maps-key');
                const data = await response.json();
                const apiKey = data.apiKey;

                if (!apiKey) {
                    console.warn('Google Maps API Key não configurada');
                    setIsLoading(false);
                    return;
                }

                await loadGoogleMaps(apiKey);
                setIsLoading(false);
            } catch (error) {
                console.error('Erro ao carregar Google Maps:', error);
                setIsLoading(false);
            }
        };

        loadMap();
    }, []);

    // Inicializar mapa
    useEffect(() => {
        if (!mapRef.current || !window.google || isLoading) return;

        const newMap = new window.google.maps.Map(mapRef.current, {
            center: { lat: -23.5505, lng: -46.6333 }, // São Paulo
            zoom: 10,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true
        });

        setMap(newMap);
    }, [isLoading]);

    // Desenhar executivos e restaurantes no mapa
    useEffect(() => {
        if (!map || !window.google) return;

        // Limpar marcadores anteriores
        markers.forEach(m => m.setMap(null));
        sellerCircles.forEach(c => c.setMap(null));

        const newMarkers: any[] = [];
        const newCircles: any[] = [];

        // Cores para executivos
        const sellerColors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
        ];

        // Desenhar círculos dos executivos
        sellers.forEach((seller, index) => {
            if (seller.baseLatitude && seller.baseLongitude && seller.raioKm && seller.territorioAtivo) {
                const color = sellerColors[index % sellerColors.length];
                
                const circle = new window.google.maps.Circle({
                    strokeColor: color,
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: color,
                    fillOpacity: 0.15,
                    map: map,
                    center: { lat: seller.baseLatitude, lng: seller.baseLongitude },
                    radius: seller.raioKm * 1000
                });

                newCircles.push(circle);

                // Marcador do executivo
                const marker = new window.google.maps.Marker({
                    position: { lat: seller.baseLatitude, lng: seller.baseLongitude },
                    map: map,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: color,
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2
                    },
                    title: `${seller.name} - ${seller.baseCidade || 'Sem cidade'}`
                });

                newMarkers.push(marker);
            }
        });

        // Filtrar restaurantes
        const filteredRestaurants = restaurants.filter(r => {
            if (filterStatus !== 'all' && r.status !== filterStatus) return false;
            if (filterPotential !== 'all' && r.salesPotential !== filterPotential) return false;
            return true;
        });

        // Desenhar restaurantes
        filteredRestaurants.forEach(restaurant => {
            if (restaurant.latitude && restaurant.longitude) {
                const seller = sellers.find(s => s.id === restaurant.sellerId);
                const color = seller 
                    ? sellerColors[sellers.indexOf(seller) % sellerColors.length]
                    : '#95a5a6';

                const marker = new window.google.maps.Marker({
                    position: { lat: restaurant.latitude, lng: restaurant.longitude },
                    map: map,
                    icon: {
                        path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                        scale: 6,
                        fillColor: color,
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 1,
                        rotation: 180
                    },
                    title: `${restaurant.name} - ${restaurant.sellerId ? seller?.name : 'Sem atribuição'}`
                });

                // Info window
                const infoWindow = new window.google.maps.InfoWindow({
                    content: `
                        <div style="padding: 0.5rem;">
                            <strong>${restaurant.name}</strong><br/>
                            ${restaurant.address?.city || 'Cidade não informada'}<br/>
                            <small>Status: ${restaurant.status || 'N/A'}</small><br/>
                            <small>Potencial: ${restaurant.salesPotential || 'N/A'}</small><br/>
                            <small>Executivo: ${restaurant.sellerId ? seller?.name : 'Sem atribuição'}</small>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });

                newMarkers.push(marker);
            }
        });

        setMarkers(newMarkers);
        setSellerCircles(newCircles);

        // Ajustar zoom para mostrar todos
        if (newMarkers.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            newMarkers.forEach(m => {
                const pos = m.getPosition();
                if (pos) bounds.extend(pos);
            });
            map.fitBounds(bounds);
        }
    }, [map, sellers, restaurants, filterStatus, filterPotential]);

    const handleAssignRestaurant = async (restaurantId: string, sellerId: string | null) => {
        try {
            const response = await fetch('/api/restaurants/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restaurantId, sellerId })
            });

            if (response.ok) {
                window.location.reload();
            } else {
                alert('Erro ao atribuir restaurante');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao atribuir restaurante');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <p>Carregando mapa...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.sidebar}>
                <h2>🗺️ Atribuição Visual</h2>
                
                <div className={styles.filters}>
                    <div className={styles.filterGroup}>
                        <label>Filtrar por Status:</label>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="A Analisar">A Analisar</option>
                            <option value="Em Negociação">Em Negociação</option>
                            <option value="Fechado">Fechado</option>
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label>Filtrar por Potencial:</label>
                        <select value={filterPotential} onChange={(e) => setFilterPotential(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="Alto">Alto</option>
                            <option value="Médio">Médio</option>
                            <option value="Baixo">Baixo</option>
                        </select>
                    </div>
                </div>

                <div className={styles.sellersList}>
                    <h3>Executivos:</h3>
                    {sellers.map((seller, index) => {
                        const sellerRestaurants = restaurants.filter(r => r.sellerId === seller.id);
                        return (
                            <div
                                key={seller.id}
                                className={`${styles.sellerCard} ${selectedSeller?.id === seller.id ? styles.selected : ''}`}
                                onClick={() => setSelectedSeller(seller)}
                            >
                                <div className={styles.sellerColor} style={{
                                    background: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'][index % 5]
                                }} />
                                <div className={styles.sellerInfo}>
                                    <strong>{seller.name}</strong>
                                    <small>{seller.baseCidade || 'Sem cidade base'}</small>
                                    <small>{sellerRestaurants.length} restaurantes</small>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={styles.legend}>
                    <h3>Legenda:</h3>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#3498db' }} />
                        <span>Círculo = Área de cobertura do executivo</span>
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#95a5a6' }} />
                        <span>Ponto = Restaurante sem atribuição</span>
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#2ecc71' }} />
                        <span>Ponto colorido = Restaurante atribuído</span>
                    </div>
                </div>
            </div>

            <div className={styles.mapContainer}>
                <div ref={mapRef} className={styles.map} />
            </div>
        </div>
    );
}

