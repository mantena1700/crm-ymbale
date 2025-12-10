'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { applyScheduleReorganization, autoOptimizeWeekSchedule } from './actions';
import styles from './MapaTecnologico.module.css';

interface Restaurant {
    id: string;
    name: string;
    address: any;
    salesPotential: string | null;
    rating: number;
    status: string;
}

interface ScheduledSlot {
    id: string;
    restaurantId: string;
    restaurantName: string;
    time: string;
    date: string;
}

interface WeekDay {
    date: string;
    dayName: string;
    dayNum: number;
    isToday: boolean;
    slots: ScheduledSlot[];
}

interface DistanceAnalysis {
    day: string;
    totalDistance: number;
    maxGap: number;
    avgDistance: number;
    isOptimal: boolean;
    suggestion?: string;
}

interface MapaTecnologicoProps {
    restaurants: Restaurant[];
    scheduledSlots?: ScheduledSlot[];
    weekStart?: Date;
    sellerId?: string;
    onSuggestReorganization?: (suggestions: any[]) => void;
    onScheduleUpdated?: () => void;
}

interface RouteSegment {
    from: string;
    to: string;
    distance: number;
    duration: number;
}

const POTENTIAL_COLORS: Record<string, string> = {
    'ALTISSIMO': '#ef4444',
    'ALTO': '#fbbf24',
    'MEDIO': '#3b82f6',
    'BAIXO': '#9ca3af',
};

export default function MapaTecnologico({ 
    restaurants, 
    scheduledSlots = [], 
    weekStart = new Date(),
    sellerId = '',
    onSuggestReorganization,
    onScheduleUpdated
}: MapaTecnologicoProps) {
    const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
    const [mapLoaded, setMapLoaded] = useState(false);
    const [isLoadingMap, setIsLoadingMap] = useState(true);
    const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
    const [showRoute, setShowRoute] = useState(false);
    const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [distanceAnalysis, setDistanceAnalysis] = useState<DistanceAnalysis[]>([]);
    const [showWeekPlan, setShowWeekPlan] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [reorganizationSuggestions, setReorganizationSuggestions] = useState<any[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationResult, setOptimizationResult] = useState<string | null>(null);
    const [totalDistance, setTotalDistance] = useState<number>(0);
    const [totalDuration, setTotalDuration] = useState<number>(0);
    const [geocodingProgress, setGeocodingProgress] = useState(0);
    const [geocodedCount, setGeocodedCount] = useState(0);
    
    // Opções avançadas
    const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
    const [showTraffic, setShowTraffic] = useState(false);
    const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT'>('DRIVING');
    const [optimizeRoute, setOptimizeRoute] = useState(true);
    const [avoidHighways, setAvoidHighways] = useState(false);
    const [avoidTolls, setAvoidTolls] = useState(false);
    const [showDistances, setShowDistances] = useState(true);
    const [showMarkerLabels, setShowMarkerLabels] = useState(true);
    const [clusterMarkers, setClusterMarkers] = useState(false);
    const [animateRoute, setAnimateRoute] = useState(true);
    
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
    const geocodedLocations = useRef<Map<string, { lat: number; lng: number }>>(new Map());

    // Estatísticas
    const stats = useMemo(() => ({
        total: restaurants.length,
        altissimo: restaurants.filter(r => r.salesPotential?.toUpperCase() === 'ALTISSIMO').length,
        alto: restaurants.filter(r => r.salesPotential?.toUpperCase() === 'ALTO').length,
        medio: restaurants.filter(r => r.salesPotential?.toUpperCase() === 'MEDIO').length,
        baixo: restaurants.filter(r => !r.salesPotential || r.salesPotential?.toUpperCase() === 'BAIXO').length,
        selected: selectedRestaurants.size,
    }), [restaurants, selectedRestaurants]);

    // Processar dias da semana com agendamentos
    const weekDays = useMemo(() => {
        const days: WeekDay[] = [];
        const startDate = new Date(weekStart);
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            const daySlots = scheduledSlots.filter(s => s.date === dateStr)
                .sort((a, b) => a.time.localeCompare(b.time));
            
            days.push({
                date: dateStr,
                dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
                dayNum: date.getDate(),
                isToday: date.toDateString() === new Date().toDateString(),
                slots: daySlots
            });
        }
        return days;
    }, [weekStart, scheduledSlots]);

    // Selecionar restaurantes de um dia específico
    const selectDayRestaurants = useCallback((dateStr: string) => {
        const daySlots = scheduledSlots.filter(s => s.date === dateStr);
        const restaurantIds = daySlots.map(s => s.restaurantId);
        
        // Filtrar apenas os que têm localização geocodificada
        const validIds = restaurantIds.filter(id => geocodedLocations.current.has(id));
        
        if (validIds.length === 0) {
            alert('Nenhum restaurante deste dia tem localização válida para calcular rota.');
            return;
        }
        
        if (validIds.length < restaurantIds.length) {
            const missing = restaurantIds.length - validIds.length;
            alert(`${missing} restaurante(s) não têm localização válida e serão ignorados na rota.`);
        }
        
        setSelectedRestaurants(new Set(validIds));
        setSelectedDay(dateStr);
        
        console.log(`📅 Selecionados ${validIds.length} restaurantes do dia ${dateStr}`);
    }, [scheduledSlots]);

    // Calcular distância entre duas coordenadas
    const calculateDistance = (loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }): number => {
        const R = 6371; // Raio da Terra em km
        const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
        const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    // Analisar distâncias de todos os dias da semana
    const analyzeWeekDistances = useCallback(async () => {
        if (geocodedLocations.current.size === 0) {
            alert('Aguarde a geocodificação dos restaurantes terminar.');
            return;
        }

        setIsAnalyzing(true);
        const analysis: DistanceAnalysis[] = [];
        const suggestions: any[] = [];

        for (const day of weekDays) {
            if (day.slots.length < 2) {
                analysis.push({
                    day: day.date,
                    totalDistance: 0,
                    maxGap: 0,
                    avgDistance: 0,
                    isOptimal: true,
                });
                continue;
            }

            // Obter localizações dos restaurantes do dia
            const locations = day.slots
                .map(s => ({
                    id: s.restaurantId,
                    name: s.restaurantName,
                    time: s.time,
                    location: geocodedLocations.current.get(s.restaurantId)
                }))
                .filter(l => l.location);

            if (locations.length < 2) {
                analysis.push({
                    day: day.date,
                    totalDistance: 0,
                    maxGap: 0,
                    avgDistance: 0,
                    isOptimal: true,
                });
                continue;
            }

            // Calcular distâncias entre visitas consecutivas
            let totalDist = 0;
            let maxGap = 0;
            let maxGapPair: any = null;

            for (let i = 0; i < locations.length - 1; i++) {
                const dist = calculateDistance(locations[i].location!, locations[i + 1].location!);
                totalDist += dist;
                if (dist > maxGap) {
                    maxGap = dist;
                    maxGapPair = {
                        from: locations[i],
                        to: locations[i + 1],
                        distance: dist
                    };
                }
            }

            const avgDist = totalDist / (locations.length - 1);
            const isOptimal = maxGap < 10; // Considera ótimo se nenhum gap > 10km

            analysis.push({
                day: day.date,
                totalDistance: totalDist,
                maxGap: maxGap,
                avgDistance: avgDist,
                isOptimal,
                suggestion: !isOptimal ? `Grande distância (${maxGap.toFixed(1)}km) entre ${maxGapPair?.from.name} e ${maxGapPair?.to.name}` : undefined
            });

            // Gerar sugestões de reorganização se não for ótimo
            if (!isOptimal && maxGapPair) {
                // Procurar restaurantes de outros dias que ficam perto
                for (const otherDay of weekDays) {
                    if (otherDay.date === day.date) continue;
                    
                    for (const slot of otherDay.slots) {
                        const slotLocation = geocodedLocations.current.get(slot.restaurantId);
                        if (!slotLocation) continue;
                        
                        // Verificar se este restaurante fica mais perto dos pontos problemáticos
                        const distFromGapStart = calculateDistance(maxGapPair.from.location, slotLocation);
                        const distFromGapEnd = calculateDistance(maxGapPair.to.location, slotLocation);
                        
                        if (distFromGapStart < maxGap / 2 || distFromGapEnd < maxGap / 2) {
                            suggestions.push({
                                type: 'swap',
                                message: `Considere trocar "${slot.restaurantName}" de ${otherDay.dayName} para ${day.dayName}`,
                                fromDay: otherDay.date,
                                toDay: day.date,
                                restaurantId: slot.restaurantId,
                                restaurantName: slot.restaurantName,
                                potentialSaving: Math.max(maxGap - distFromGapStart, maxGap - distFromGapEnd)
                            });
                        }
                    }
                }
            }
        }

        // Ordenar sugestões por economia potencial
        suggestions.sort((a, b) => b.potentialSaving - a.potentialSaving);

        setDistanceAnalysis(analysis);
        setReorganizationSuggestions(suggestions.slice(0, 5)); // Top 5 sugestões
        setIsAnalyzing(false);

        if (onSuggestReorganization && suggestions.length > 0) {
            onSuggestReorganization(suggestions);
        }

        console.log('📊 Análise de distâncias:', analysis);
        console.log('💡 Sugestões:', suggestions);
    }, [weekDays, onSuggestReorganization]);

    // Aplicar uma sugestão específica
    const applySingleSuggestion = async (suggestion: any) => {
        if (!sellerId) {
            alert('Erro: Vendedor não identificado');
            return;
        }

        setIsOptimizing(true);
        try {
            const result = await applyScheduleReorganization(sellerId, [{
                restaurantId: suggestion.restaurantId,
                fromDate: suggestion.fromDay,
                toDate: suggestion.toDay,
                fromTime: '09:00' // Horário padrão
            }]);

            if (result.success) {
                setOptimizationResult(`✅ "${suggestion.restaurantName}" movido com sucesso!`);
                // Remover a sugestão aplicada
                setReorganizationSuggestions(prev => 
                    prev.filter(s => s.restaurantId !== suggestion.restaurantId)
                );
                // Notificar o componente pai para recarregar os dados
                if (onScheduleUpdated) {
                    onScheduleUpdated();
                }
            } else {
                setOptimizationResult(`❌ Erro: ${result.error}`);
            }
        } catch (error) {
            console.error('Erro ao aplicar sugestão:', error);
            setOptimizationResult('❌ Erro ao aplicar otimização');
        } finally {
            setIsOptimizing(false);
            setTimeout(() => setOptimizationResult(null), 3000);
        }
    };

    // Aplicar todas as sugestões de uma vez
    const applyAllSuggestions = async () => {
        if (!sellerId) {
            alert('Erro: Vendedor não identificado');
            return;
        }

        if (reorganizationSuggestions.length === 0) {
            alert('Não há sugestões para aplicar');
            return;
        }

        const confirmacao = confirm(
            `Deseja aplicar ${reorganizationSuggestions.length} reorganização(ões)?\n\n` +
            `Isso vai mover os restaurantes para dias mais otimizados automaticamente.`
        );

        if (!confirmacao) return;

        setIsOptimizing(true);
        try {
            const reorganizations = reorganizationSuggestions.map(s => ({
                restaurantId: s.restaurantId,
                fromDate: s.fromDay,
                toDate: s.toDay,
                fromTime: '09:00'
            }));

            const result = await applyScheduleReorganization(sellerId, reorganizations);

            if (result.success) {
                setOptimizationResult(`✅ ${result.message}`);
                setReorganizationSuggestions([]);
                setDistanceAnalysis([]);
                if (onScheduleUpdated) {
                    onScheduleUpdated();
                }
            } else {
                setOptimizationResult(`❌ Erro: ${result.error}`);
            }
        } catch (error) {
            console.error('Erro ao aplicar otimizações:', error);
            setOptimizationResult('❌ Erro ao aplicar otimizações');
        } finally {
            setIsOptimizing(false);
            setTimeout(() => setOptimizationResult(null), 5000);
        }
    };

    // Otimização automática completa
    const autoOptimizeSchedule = async () => {
        if (!sellerId) {
            alert('Erro: Vendedor não identificado');
            return;
        }

        if (geocodedLocations.current.size === 0) {
            alert('Aguarde a geocodificação dos restaurantes terminar.');
            return;
        }

        const confirmacao = confirm(
            '🧠 Otimização Automática\n\n' +
            'Isso vai analisar toda sua agenda da semana e reorganizar ' +
            'automaticamente os restaurantes para minimizar deslocamentos.\n\n' +
            'Deseja continuar?'
        );

        if (!confirmacao) return;

        setIsOptimizing(true);
        setOptimizationResult('🔄 Analisando e otimizando...');

        try {
            // Converter geocodedLocations para objeto simples
            const locations: Record<string, { lat: number; lng: number }> = {};
            geocodedLocations.current.forEach((value, key) => {
                locations[key] = value;
            });

            const result = await autoOptimizeWeekSchedule(
                sellerId, 
                weekStart.toISOString(),
                locations
            );

            if (result.success) {
                setOptimizationResult(`✅ ${result.message}`);
                setReorganizationSuggestions([]);
                setDistanceAnalysis([]);
                if (onScheduleUpdated) {
                    onScheduleUpdated();
                }
                // Re-analisar após otimização
                setTimeout(() => analyzeWeekDistances(), 1000);
            } else {
                setOptimizationResult(`❌ ${result.error || result.message}`);
            }
        } catch (error) {
            console.error('Erro na otimização automática:', error);
            setOptimizationResult('❌ Erro na otimização automática');
        } finally {
            setIsOptimizing(false);
            setTimeout(() => setOptimizationResult(null), 5000);
        }
    };

    // Carregar Google Maps usando o loader centralizado
    useEffect(() => {
        // Buscar API key do banco de dados
        const loadMapWithApiKey = async () => {
            try {
                // Tentar buscar a chave da API do banco de dados
                const response = await fetch('/api/google-maps-key');
                const data = await response.json();
                const apiKey = data.apiKey;
                
                if (!apiKey) {
                    console.warn('⚠️ Google Maps API Key não configurada no banco de dados. Configure nas Configurações > Chaves de API');
                    setIsLoadingMap(false);
                    return;
                }
                
                // Carregar Google Maps com a chave do banco
                await loadGoogleMaps(apiKey);
                setMapLoaded(true);
                setIsLoadingMap(false);
            } catch (error) {
                console.error('Erro ao carregar Google Maps:', error);
                setIsLoadingMap(false);
            }
        };
        
        loadMapWithApiKey();
    }, []);

    // Inicializar mapa
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || googleMapRef.current) return;

        const mapCenter = { lat: -23.5505, lng: -46.6333 };

        googleMapRef.current = new google.maps.Map(mapRef.current, {
            center: mapCenter,
            zoom: 12,
            mapTypeId: mapType,
            styles: [
                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
            ],
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: true,
            scaleControl: true,
            streetViewControl: true,
            rotateControl: true,
            fullscreenControl: true
        });

        directionsRendererRef.current = new google.maps.DirectionsRenderer({
            map: googleMapRef.current,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#6366f1',
                strokeWeight: 5,
                strokeOpacity: 0.9
            }
        });

        trafficLayerRef.current = new google.maps.TrafficLayer();

        // Geocodificar restaurantes
        geocodeRestaurants();
    }, [mapLoaded]);

    // Atualizar tipo de mapa
    useEffect(() => {
        if (googleMapRef.current) {
            googleMapRef.current.setMapTypeId(mapType);
        }
    }, [mapType]);

    // Atualizar camada de tráfego
    useEffect(() => {
        if (trafficLayerRef.current && googleMapRef.current) {
            trafficLayerRef.current.setMap(showTraffic ? googleMapRef.current : null);
        }
    }, [showTraffic]);

    // Geocodificar restaurantes
    const geocodeRestaurants = async () => {
        if (!googleMapRef.current) return;

        console.log('🌍 Iniciando geocodificação de', restaurants.length, 'restaurantes');
        const geocoder = new google.maps.Geocoder();
        const processed = [];

        for (const restaurant of restaurants) {
            const address = buildAddress(restaurant);
            try {
                const result = await geocoder.geocode({ address });
                if (result.results[0]) {
                    const location = result.results[0].geometry.location;
                    // Converter para objeto literal para evitar erros de serialização
                    const coords = {
                        lat: location.lat(),
                        lng: location.lng()
                    };
                    geocodedLocations.current.set(restaurant.id, coords);
                    processed.push(restaurant.id);
                    console.log('📍 Geocodificado:', restaurant.name, coords);
                }
            } catch (error) {
                console.error(`❌ Erro ao geocodificar ${restaurant.name}:`, error);
            }
            setGeocodingProgress(Math.round((processed.length / restaurants.length) * 100));
            setGeocodedCount(geocodedLocations.current.size);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('✅ Geocodificação concluída:', processed.length, 'de', restaurants.length);
        setGeocodedCount(geocodedLocations.current.size);
        createMarkers();
    };

    const buildAddress = (restaurant: Restaurant): string => {
        const parts = [];
        const addr = restaurant.address;
        
        // Log para debug
        console.log(`📍 Construindo endereço para ${restaurant.name}:`, addr);
        
        // Adiciona componentes do endereço se existirem e não forem "undefined" ou vazios
        if (addr?.street && addr.street !== 'undefined' && addr.street.trim()) {
            parts.push(addr.street.trim());
        }
        if (addr?.neighborhood && addr.neighborhood !== 'undefined' && addr.neighborhood.trim()) {
            parts.push(addr.neighborhood.trim());
        }
        if (addr?.city && addr.city !== 'undefined' && addr.city.trim()) {
            parts.push(addr.city.trim());
        }
        if (addr?.state && addr.state !== 'undefined' && addr.state.trim()) {
            parts.push(addr.state.trim());
        }
        
        // Sempre adicionar Brasil para melhorar a geocodificação
        parts.push('Brasil');
        
        const address = parts.length > 1 ? parts.join(', ') : `${restaurant.name}, Brasil`;
        console.log(`📍 Endereço final: ${address}`);
        return address;
    };

    const getPotentialColor = (potential: string | null): string => {
        if (!potential) return POTENTIAL_COLORS['BAIXO'];
        return POTENTIAL_COLORS[potential.toUpperCase()] || POTENTIAL_COLORS['BAIXO'];
    };

    // Criar marcadores
    const createMarkers = () => {
        if (!googleMapRef.current) {
            console.log('⚠️ Mapa não carregado ainda');
            return;
        }

        console.log('🗺️ Criando marcadores...', {
            totalRestaurants: restaurants.length,
            geocoded: geocodedLocations.current.size,
            selected: selectedRestaurants.size
        });

        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        let markersCreated = 0;
        restaurants.forEach(restaurant => {
            const location = geocodedLocations.current.get(restaurant.id);
            if (!location) {
                console.log('⚠️ Sem localização para:', restaurant.name);
                return;
            }

            const isSelected = selectedRestaurants.has(restaurant.id);
            markersCreated++;

            const marker = new google.maps.Marker({
                position: location,
                map: googleMapRef.current!,
                title: restaurant.name,
                label: showMarkerLabels ? {
                    text: restaurant.name.substring(0, 1),
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold'
                } : undefined,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isSelected ? 12 : 10,
                    fillColor: getPotentialColor(restaurant.salesPotential),
                    fillOpacity: isSelected ? 1 : 0.7,
                    strokeColor: isSelected ? '#fff' : '#333',
                    strokeWeight: isSelected ? 3 : 2,
                },
                animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
                zIndex: isSelected ? 1000 : 100,
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 12px; font-family: system-ui;">
                        <h3 style="margin: 0 0 8px; color: #1e293b;">${restaurant.name}</h3>
                        <p style="margin: 4px 0; color: #64748b;">
                            <strong>Potencial:</strong> ${restaurant.salesPotential || 'N/A'}
                        </p>
                        <p style="margin: 4px 0; color: #64748b;">
                            <strong>Avaliação:</strong> ⭐ ${restaurant.rating.toFixed(1)}
                        </p>
                        <button 
                            onclick="window.dispatchEvent(new CustomEvent('toggleRestaurant', {detail: '${restaurant.id}'}))"
                            style="margin-top: 8px; padding: 6px 12px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;"
                        >
                            ${isSelected ? 'Remover' : 'Adicionar'} à Rota
                        </button>
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(googleMapRef.current!, marker);
            });

            markersRef.current.push(marker);
        });

        console.log('✅ Marcadores criados:', markersCreated);

        // Ajustar bounds
        if (markersRef.current.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            markersRef.current.forEach(marker => {
                const pos = marker.getPosition();
                if (pos) bounds.extend(pos);
            });
            googleMapRef.current?.fitBounds(bounds);
            console.log('📍 Bounds ajustados para', markersRef.current.length, 'marcadores');
        } else {
            console.log('⚠️ Nenhum marcador criado');
        }
    };

    // Event listener para toggle de restaurante
    useEffect(() => {
        const handleToggle = (e: any) => {
            toggleRestaurant(e.detail);
        };
        window.addEventListener('toggleRestaurant', handleToggle);
        return () => window.removeEventListener('toggleRestaurant', handleToggle);
    }, []);

    // Atualizar marcadores quando seleção mudar
    useEffect(() => {
        console.log('🔄 useEffect: seleção ou labels mudaram', {
            selected: selectedRestaurants.size,
            showLabels: showMarkerLabels,
            mapLoaded: !!googleMapRef.current,
            geocoded: geocodedLocations.current.size
        });
        if (googleMapRef.current && geocodedLocations.current.size > 0) {
            createMarkers();
        }
    }, [selectedRestaurants, showMarkerLabels]);

    const toggleRestaurant = (id: string) => {
        console.log('🔄 Toggle restaurant:', id);
        setSelectedRestaurants(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
                console.log('➖ Removido da seleção:', id);
            } else {
                newSet.add(id);
                console.log('➕ Adicionado à seleção:', id);
            }
            console.log('📍 Total selecionados:', newSet.size);
            return newSet;
        });
    };

    const calculateRoute = async () => {
        if (selectedRestaurants.size < 2) {
            alert('Selecione pelo menos 2 restaurantes');
            return;
        }

        // Verificar quais restaurantes selecionados foram geocodificados
        const ids = Array.from(selectedRestaurants);
        const geocodedIds = ids.filter(id => geocodedLocations.current.has(id));
        const notGeocodedIds = ids.filter(id => !geocodedLocations.current.has(id));
        
        console.log('📊 Validação de seleção:', {
            selecionados: ids.length,
            geocodificados: geocodedIds.length,
            naoGeocodificados: notGeocodedIds.length
        });
        
        if (notGeocodedIds.length > 0) {
            const notGeocodedNames = notGeocodedIds
                .map(id => restaurants.find(r => r.id === id)?.name || id)
                .join('\n- ');
            
            console.warn('⚠️ Restaurantes sem geocodificação:', notGeocodedIds);
            
            if (geocodedIds.length < 2) {
                alert(`Não foi possível calcular a rota.\n\nOs seguintes restaurantes não têm localização válida:\n- ${notGeocodedNames}\n\nVerifique se os endereços estão corretos.`);
                return;
            }
            
            const continuar = confirm(`Alguns restaurantes não têm localização válida:\n- ${notGeocodedNames}\n\nDeseja continuar com os ${geocodedIds.length} restaurantes que têm localização?`);
            if (!continuar) return;
        }

        if (geocodedIds.length < 2) {
            alert('É necessário pelo menos 2 restaurantes com localização válida para calcular a rota.');
            return;
        }

        setIsCalculatingRoute(true);
        const service = new google.maps.DirectionsService();
        
        // Usar apenas os restaurantes geocodificados
        const validIds = geocodedIds;
        
        // Obter localizações e garantir o formato correto
        const originCoords = geocodedLocations.current.get(validIds[0]);
        const destinationCoords = geocodedLocations.current.get(validIds[validIds.length - 1]);
        
        if (!originCoords || !destinationCoords) {
            console.error('❌ Localizações de origem ou destino não encontradas');
            alert('Erro: Não foi possível encontrar as localizações dos restaurantes selecionados');
            setIsCalculatingRoute(false);
            return;
        }
        
        // Converter para LatLng do Google Maps
        const origin = new google.maps.LatLng(originCoords.lat, originCoords.lng);
        const destination = new google.maps.LatLng(destinationCoords.lat, destinationCoords.lng);
        
        const waypoints: google.maps.DirectionsWaypoint[] = [];
        for (const id of validIds.slice(1, -1)) {
            const coords = geocodedLocations.current.get(id);
            if (coords) {
                waypoints.push({
                    location: new google.maps.LatLng(coords.lat, coords.lng),
                    stopover: true
                });
            }
        }

        console.log('🗺️ Calculando rota:', {
            origin: { lat: originCoords.lat, lng: originCoords.lng },
            destination: { lat: destinationCoords.lat, lng: destinationCoords.lng },
            waypoints: waypoints.length,
            mode: travelMode
        });

        try {
            const result = await service.route({
                origin,
                destination,
                waypoints,
                optimizeWaypoints: optimizeRoute,
                travelMode: google.maps.TravelMode[travelMode],
                avoidHighways,
                avoidTolls,
            });

            directionsRendererRef.current?.setDirections(result);
            
            const route = result.routes[0];
            let dist = 0;
            let time = 0;
            const segments: RouteSegment[] = [];

            route.legs.forEach((leg, i) => {
                dist += leg.distance?.value || 0;
                time += leg.duration?.value || 0;
                segments.push({
                    from: restaurants.find(r => r.id === validIds[i])?.name || '',
                    to: restaurants.find(r => r.id === validIds[i + 1])?.name || '',
                    distance: (leg.distance?.value || 0) / 1000,
                    duration: Math.round((leg.duration?.value || 0) / 60)
                });
            });

            setTotalDistance(dist / 1000);
            setTotalDuration(Math.round(time / 60));
            setRouteSegments(segments);
            setShowRoute(true);
            
            console.log('✅ Rota calculada com sucesso:', {
                distance: `${(dist / 1000).toFixed(2)} km`,
                duration: `${Math.round(time / 60)} min`,
                segments: segments.length
            });
        } catch (error: any) {
            console.error('❌ Erro ao calcular rota:', error);
            const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
            alert(`Erro ao calcular rota:\n\n${errorMessage}\n\nVerifique se:\n- Os endereços estão corretos\n- Há conexão com a internet\n- A chave do Google Maps está configurada`);
        }

        setIsCalculatingRoute(false);
    };

    const selectByProximity = (count: number) => {
        const center = googleMapRef.current?.getCenter();
        if (!center || geocodedLocations.current.size === 0) return;

        const sorted = Array.from(geocodedLocations.current.entries())
            .map(([id, loc]) => ({
                id,
                distance: google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(center.lat(), center.lng()),
                    loc
                )
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count);

        setSelectedRestaurants(new Set(sorted.map(item => item.id)));
    };

    const selectByPotential = (minPotential: string) => {
        const priorities: Record<string, number> = {
            'ALTISSIMO': 4, 'ALTO': 3, 'MEDIO': 2, 'BAIXO': 1
        };
        const threshold = priorities[minPotential];
        const filtered = restaurants
            .filter(r => priorities[r.salesPotential?.toUpperCase() || 'BAIXO'] >= threshold)
            .map(r => r.id);
        setSelectedRestaurants(new Set(filtered));
    };

    const exportRoute = () => {
        if (routeSegments.length === 0) return;
        const csv = [
            ['De', 'Para', 'Distância (km)', 'Tempo (min)'],
            ...routeSegments.map(s => [s.from, s.to, s.distance.toFixed(2), s.duration.toString()]),
            [],
            ['TOTAL', '', totalDistance.toFixed(2), totalDuration.toString()]
        ].map(r => r.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `rota_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className={styles.container}>
            {/* Painel Superior */}
            <div className={styles.topPanel}>
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>📊</div>
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Total</span>
                            <span className={styles.statValue}>{stats.total}</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>🔥</div>
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Altíssimo</span>
                            <span className={styles.statValue}>{stats.altissimo}</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>⚡</div>
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Alto</span>
                            <span className={styles.statValue}>{stats.alto}</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>✓</div>
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Selecionados</span>
                            <span className={styles.statValue}>{stats.selected}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Layout Principal */}
            <div className={styles.mainLayout}>
                {/* Painel Lateral Esquerdo */}
                <div className={styles.sidebar}>
                    <div className={styles.sidebarSection}>
                        <h3>🗺️ Visualização</h3>
                        <select value={mapType} onChange={(e) => setMapType(e.target.value as any)} className={styles.select}>
                            <option value="roadmap">Mapa</option>
                            <option value="satellite">Satélite</option>
                            <option value="hybrid">Híbrido</option>
                            <option value="terrain">Terreno</option>
                        </select>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} />
                            <span>Tráfego em Tempo Real</span>
                        </label>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={showMarkerLabels} onChange={(e) => setShowMarkerLabels(e.target.checked)} />
                            <span>Rótulos nos Markers</span>
                        </label>
                    </div>

                    <div className={styles.sidebarSection}>
                        <h3>🚗 Transporte</h3>
                        <select value={travelMode} onChange={(e) => setTravelMode(e.target.value as any)} className={styles.select}>
                            <option value="DRIVING">🚗 Carro</option>
                            <option value="WALKING">🚶 A pé</option>
                            <option value="BICYCLING">🚴 Bicicleta</option>
                            <option value="TRANSIT">🚌 Transporte Público</option>
                        </select>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={optimizeRoute} onChange={(e) => setOptimizeRoute(e.target.checked)} />
                            <span>Otimizar Rota</span>
                        </label>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={avoidHighways} onChange={(e) => setAvoidHighways(e.target.checked)} />
                            <span>Evitar Rodovias</span>
                        </label>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} />
                            <span>Evitar Pedágios</span>
                        </label>
                    </div>

                    {/* Plano da Semana */}
                    {scheduledSlots.length > 0 && (
                        <div className={styles.sidebarSection}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h3>📅 Plano da Semana</h3>
                                <button 
                                    onClick={() => setShowWeekPlan(!showWeekPlan)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                >
                                    {showWeekPlan ? '▼' : '▶'}
                                </button>
                            </div>
                            
                            {showWeekPlan && (
                                <>
                                    <div style={{ marginBottom: '12px' }}>
                                        <button 
                                            onClick={analyzeWeekDistances}
                                            disabled={isAnalyzing}
                                            className={styles.quickBtn}
                                            style={{ width: '100%', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                                        >
                                            {isAnalyzing ? '⏳ Analisando...' : '🧠 Analisar Semana Inteligente'}
                                        </button>
                                    </div>
                                    
                                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                        {weekDays.map(day => {
                                            const dayAnalysis = distanceAnalysis.find(a => a.day === day.date);
                                            const isSelected = selectedDay === day.date;
                                            
                                            return (
                                                <div 
                                                    key={day.date}
                                                    style={{
                                                        padding: '8px',
                                                        margin: '4px 0',
                                                        borderRadius: '8px',
                                                        cursor: day.slots.length > 0 ? 'pointer' : 'default',
                                                        background: isSelected ? '#6366f1' : (day.isToday ? '#e0f2fe' : '#f8fafc'),
                                                        color: isSelected ? 'white' : '#1e293b',
                                                        border: day.isToday ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
                                                        opacity: day.slots.length > 0 ? 1 : 0.5
                                                    }}
                                                    onClick={() => day.slots.length > 0 && selectDayRestaurants(day.date)}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <strong style={{ fontSize: '12px' }}>
                                                            {day.dayName} {day.dayNum}
                                                            {day.isToday && ' (Hoje)'}
                                                        </strong>
                                                        <span style={{ 
                                                            fontSize: '11px', 
                                                            background: isSelected ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                                                            padding: '2px 6px',
                                                            borderRadius: '10px'
                                                        }}>
                                                            {day.slots.length} visitas
                                                        </span>
                                                    </div>
                                                    
                                                    {day.slots.length > 0 && (
                                                        <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8 }}>
                                                            {day.slots.slice(0, 3).map(s => s.restaurantName.substring(0, 15)).join(', ')}
                                                            {day.slots.length > 3 && `... +${day.slots.length - 3}`}
                                                        </div>
                                                    )}
                                                    
                                                    {dayAnalysis && (
                                                        <div style={{ 
                                                            fontSize: '10px', 
                                                            marginTop: '4px',
                                                            padding: '4px',
                                                            borderRadius: '4px',
                                                            background: dayAnalysis.isOptimal ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'
                                                        }}>
                                                            {dayAnalysis.isOptimal ? (
                                                                <span style={{ color: '#10b981' }}>✅ Rota otimizada</span>
                                                            ) : (
                                                                <span style={{ color: '#ef4444' }}>⚠️ {dayAnalysis.totalDistance.toFixed(1)}km total</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Resultado da Otimização */}
                                    {optimizationResult && (
                                        <div style={{
                                            marginTop: '12px',
                                            padding: '10px',
                                            background: optimizationResult.startsWith('✅') ? '#d1fae5' : 
                                                       optimizationResult.startsWith('🔄') ? '#e0f2fe' : '#fee2e2',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            textAlign: 'center',
                                            fontWeight: 'bold'
                                        }}>
                                            {optimizationResult}
                                        </div>
                                    )}

                                    {/* Sugestões de Reorganização */}
                                    {reorganizationSuggestions.length > 0 && (
                                        <div style={{ 
                                            marginTop: '12px', 
                                            padding: '10px', 
                                            background: '#fef3c7', 
                                            borderRadius: '8px',
                                            border: '1px solid #fbbf24'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <strong style={{ fontSize: '11px', color: '#92400e' }}>
                                                    💡 {reorganizationSuggestions.length} Sugestão(ões)
                                                </strong>
                                                <button
                                                    onClick={applyAllSuggestions}
                                                    disabled={isOptimizing}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '10px',
                                                        background: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: isOptimizing ? 'wait' : 'pointer',
                                                        opacity: isOptimizing ? 0.7 : 1
                                                    }}
                                                >
                                                    {isOptimizing ? '⏳' : '✨'} Aplicar Todas
                                                </button>
                                            </div>
                                            
                                            <div style={{ fontSize: '10px' }}>
                                                {reorganizationSuggestions.slice(0, 5).map((s, i) => (
                                                    <div key={i} style={{ 
                                                        padding: '6px', 
                                                        marginTop: '4px', 
                                                        background: 'rgba(255,255,255,0.7)',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                                                {s.restaurantName?.substring(0, 20) || 'Restaurante'}
                                                            </div>
                                                            <div style={{ color: '#64748b', fontSize: '9px' }}>
                                                                {new Date(s.fromDay).toLocaleDateString('pt-BR', { weekday: 'short' })} → {new Date(s.toDay).toLocaleDateString('pt-BR', { weekday: 'short' })}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ color: '#059669', fontSize: '10px', fontWeight: 'bold' }}>
                                                                -{s.potentialSaving?.toFixed(1) || '?'}km
                                                            </span>
                                                            <button
                                                                onClick={() => applySingleSuggestion(s)}
                                                                disabled={isOptimizing}
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    fontSize: '10px',
                                                                    background: '#6366f1',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    cursor: isOptimizing ? 'wait' : 'pointer'
                                                                }}
                                                            >
                                                                ✓
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Botão Otimização Automática Total */}
                                    {scheduledSlots.length >= 2 && (
                                        <div style={{ marginTop: '12px' }}>
                                            <button
                                                onClick={autoOptimizeSchedule}
                                                disabled={isOptimizing || geocodedCount === 0}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    background: isOptimizing ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    cursor: isOptimizing ? 'wait' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                {isOptimizing ? (
                                                    <>⏳ Otimizando...</>
                                                ) : (
                                                    <>🚀 Otimizar Semana Automaticamente</>
                                                )}
                                            </button>
                                            <p style={{ 
                                                fontSize: '9px', 
                                                color: '#64748b', 
                                                textAlign: 'center', 
                                                marginTop: '4px' 
                                            }}>
                                                Reorganiza toda a semana para minimizar deslocamentos
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className={styles.sidebarSection}>
                        <h3>🎯 Seleção Rápida</h3>
                        <button onClick={() => selectByProximity(5)} className={styles.quickBtn}>
                            📍 5 Mais Próximos
                        </button>
                        <button onClick={() => selectByProximity(10)} className={styles.quickBtn}>
                            📍 10 Mais Próximos
                        </button>
                        <button onClick={() => selectByPotential('ALTISSIMO')} className={styles.quickBtn}>
                            🔥 Altíssimo Potencial
                        </button>
                        <button onClick={() => selectByPotential('ALTO')} className={styles.quickBtn}>
                            ⚡ Alto+ Potencial
                        </button>
                        <button onClick={() => setSelectedRestaurants(new Set())} className={styles.quickBtn}>
                            ❌ Limpar Seleção
                        </button>
                    </div>

                    <div className={styles.sidebarSection}>
                        <button 
                            onClick={calculateRoute} 
                            disabled={selectedRestaurants.size < 2 || isCalculatingRoute}
                            className={styles.calculateBtn}
                        >
                            {isCalculatingRoute ? '⏳ Calculando...' : '🗺️ Calcular Rota'}
                        </button>
                        {showRoute && (
                            <button onClick={exportRoute} className={styles.exportBtn}>
                                📥 Exportar CSV
                            </button>
                        )}
                    </div>

                    {/* Lista de Restaurantes */}
                    <div className={styles.sidebarSection}>
                        <h3>📍 Restaurantes ({geocodedCount}/{restaurants.length})</h3>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '12px' }}>
                            {restaurants.map(restaurant => {
                                const hasLocation = geocodedLocations.current.has(restaurant.id);
                                const isSelected = selectedRestaurants.has(restaurant.id);
                                return (
                                    <div 
                                        key={restaurant.id}
                                        onClick={() => hasLocation && toggleRestaurant(restaurant.id)}
                                        style={{
                                            padding: '8px',
                                            margin: '4px 0',
                                            borderRadius: '6px',
                                            cursor: hasLocation ? 'pointer' : 'not-allowed',
                                            opacity: hasLocation ? 1 : 0.5,
                                            background: isSelected ? '#6366f1' : (hasLocation ? '#f1f5f9' : '#fee2e2'),
                                            color: isSelected ? 'white' : '#1e293b',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {hasLocation ? '📍' : '❌'} {restaurant.name}
                                        </span>
                                        {isSelected && <span>✓</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Mapa */}
                <div className={styles.mapArea}>
                    {isLoadingMap && (
                        <div className={styles.loading}>
                            <div className={styles.spinner}>🗺️</div>
                            <p>Carregando mapa tecnológico...</p>
                        </div>
                    )}
                    {geocodingProgress > 0 && geocodingProgress < 100 && (
                        <div className={styles.geocodingOverlay}>
                            <div className={styles.progressCard}>
                                <p>Processando {geocodingProgress}%</p>
                                <div className={styles.progressBar}>
                                    <div className={styles.progressFill} style={{ width: `${geocodingProgress}%` }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={mapRef} className={styles.map} />
                </div>

                {/* Painel Lateral Direito - Informações da Rota */}
                {showRoute && routeSegments.length > 0 && (
                    <div className={styles.routePanel}>
                        <div className={styles.routeHeader}>
                            <h3>📊 Detalhes da Rota</h3>
                            <button onClick={() => setShowRoute(false)} className={styles.closeBtn}>×</button>
                        </div>
                        
                        <div className={styles.routeSummary}>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryIcon}>📏</span>
                                <div>
                                    <span className={styles.summaryLabel}>Distância</span>
                                    <strong>{totalDistance.toFixed(2)} km</strong>
                                </div>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryIcon}>⏱️</span>
                                <div>
                                    <span className={styles.summaryLabel}>Tempo</span>
                                    <strong>{Math.floor(totalDuration / 60)}h {totalDuration % 60}min</strong>
                                </div>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryIcon}>📍</span>
                                <div>
                                    <span className={styles.summaryLabel}>Paradas</span>
                                    <strong>{routeSegments.length + 1}</strong>
                                </div>
                            </div>
                        </div>

                        <div className={styles.segmentsList}>
                            {routeSegments.map((seg, i) => (
                                <div key={i} className={styles.segment}>
                                    <div className={styles.segmentNumber}>{i + 1}</div>
                                    <div className={styles.segmentInfo}>
                                        <div className={styles.segmentRoute}>
                                            <span>{seg.from}</span>
                                            <span className={styles.arrow}>→</span>
                                            <span>{seg.to}</span>
                                        </div>
                                        <div className={styles.segmentMeta}>
                                            <span>📏 {seg.distance.toFixed(2)} km</span>
                                            <span>⏱️ {seg.duration} min</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

