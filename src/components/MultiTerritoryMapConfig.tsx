'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import styles from './TerritoryMapConfig.module.css';

interface Area {
  id: string;
  cidade: string;
  latitude: number;
  longitude: number;
  raioKm: number;
}

interface MultiTerritoryMapConfigProps {
  areas?: Area[];
  onAreasChange: (areas: Area[]) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export default function MultiTerritoryMapConfig({
  areas = [],
  onAreasChange
}: MultiTerritoryMapConfigProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentRaio, setCurrentRaio] = useState(50);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [autocomplete, setAutocomplete] = useState<any>(null);

  // Cores diferentes para cada área
  const areaColors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
  ];

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

    const initialCenter = areas.length > 0
      ? { lat: areas[0].latitude, lng: areas[0].longitude }
      : { lat: -23.5505, lng: -46.6333 }; // São Paulo padrão

    const newMap = new window.google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom: areas.length > 0 ? 12 : 10,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    setMap(newMap);

    // Configurar autocomplete
    const input = document.getElementById('city-search') as HTMLInputElement;
    if (input && window.google.maps.places) {
      const autocompleteInstance = new window.google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        componentRestrictions: { country: 'br' }
      });

      setAutocomplete(autocompleteInstance);

      autocompleteInstance.addListener('place_changed', () => {
        const place = autocompleteInstance.getPlace();
        if (place.geometry) {
          const location = place.geometry.location;
          const lat = location.lat();
          const lng = location.lng();
          const cityName = place.formatted_address || place.name;

          // Adicionar nova área
          const newArea: Area = {
            id: Date.now().toString(),
            cidade: cityName,
            latitude: lat,
            longitude: lng,
            raioKm: currentRaio
          };

          onAreasChange([...areas, newArea]);
          setSearchQuery('');
        }
      });
    }
  }, [isLoading]);

  // Desenhar áreas no mapa
  useEffect(() => {
    if (!map || !window.google) return;

    // Limpar marcadores e círculos anteriores
    markers.forEach(m => m.setMap(null));
    circles.forEach(c => c.setMap(null));

    const newMarkers: any[] = [];
    const newCircles: any[] = [];

    areas.forEach((area, index) => {
      const color = areaColors[index % areaColors.length];

      // Círculo de cobertura
      const circle = new window.google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.15,
        map: map,
        center: { lat: area.latitude, lng: area.longitude },
        radius: area.raioKm * 1000
      });

      newCircles.push(circle);

      // Marcador
      const marker = new window.google.maps.Marker({
        position: { lat: area.latitude, lng: area.longitude },
        map: map,
        draggable: true,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2
        },
        title: `${area.cidade} - ${area.raioKm}km`
      });

      // Info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 0.5rem;">
            <strong>${area.cidade}</strong><br/>
            Raio: ${area.raioKm}km<br/>
            <button onclick="window.selectArea('${area.id}')" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Editar
            </button>
            <button onclick="window.removeArea('${area.id}')" style="margin-top: 0.5rem; margin-left: 0.25rem; padding: 0.25rem 0.5rem; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Remover
            </button>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      // Listener para arrastar
      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        const lat = position.lat();
        const lng = position.lng();

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results[0]) {
            const updatedAreas = areas.map(a =>
              a.id === area.id
                ? { ...a, latitude: lat, longitude: lng, cidade: results[0].formatted_address }
                : a
            );
            onAreasChange(updatedAreas);
          }
        });
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
    setCircles(newCircles);

    // Ajustar zoom para mostrar todas as áreas
    if (newCircles.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      newCircles.forEach(c => {
        const center = c.getCenter();
        const radius = c.getRadius();
        const north = center.lat() + (radius / 111000);
        const south = center.lat() - (radius / 111000);
        const east = center.lng() + (radius / (111000 * Math.cos(center.lat() * Math.PI / 180)));
        const west = center.lng() - (radius / (111000 * Math.cos(center.lat() * Math.PI / 180)));
        bounds.extend({ lat: north, lng: east });
        bounds.extend({ lat: south, lng: west });
      });
      map.fitBounds(bounds);
    }

    // Funções globais para os botões
    (window as any).selectArea = (id: string) => {
      const area = areas.find(a => a.id === id);
      if (area) {
        setSelectedArea(area);
        setCurrentRaio(area.raioKm);
        map.setCenter({ lat: area.latitude, lng: area.longitude });
        map.setZoom(12);
      }
    };

    (window as any).removeArea = (id: string) => {
      const updatedAreas = areas.filter(a => a.id !== id);
      onAreasChange(updatedAreas);
      if (selectedArea?.id === id) {
        setSelectedArea(null);
      }
    };
  }, [map, areas]);

  // Atualizar círculo quando raio mudar
  useEffect(() => {
    if (selectedArea && circles.length > 0) {
      const areaIndex = areas.findIndex(a => a.id === selectedArea.id);
      if (areaIndex >= 0 && circles[areaIndex]) {
        circles[areaIndex].setRadius(currentRaio * 1000);
        if (map) {
          map.fitBounds(circles[areaIndex].getBounds());
        }

        // Atualizar área
        const updatedAreas = areas.map(a =>
          a.id === selectedArea.id ? { ...a, raioKm: currentRaio } : a
        );
        onAreasChange(updatedAreas);
      }
    }
  }, [currentRaio, selectedArea]);

  const handleRaioChange = (newRaio: number) => {
    setCurrentRaio(newRaio);
    if (selectedArea) {
      const updatedAreas = areas.map(a =>
        a.id === selectedArea.id ? { ...a, raioKm: newRaio } : a
      );
      onAreasChange(updatedAreas);
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
      <div className={styles.searchBox}>
        <label htmlFor="city-search">📍 Adicionar Nova Área:</label>
        <input
          id="city-search"
          type="text"
          placeholder="Digite o nome da cidade (ex: Sorocaba, SP)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <p className={styles.hint}>💡 Digite o nome da cidade e selecione nas sugestões para adicionar</p>
      </div>

      {selectedArea && (
        <div className={styles.raioControl}>
          <label htmlFor="raio-slider">
            Raio de Atendimento - {selectedArea.cidade}: <strong>{currentRaio} km</strong>
          </label>
          <input
            id="raio-slider"
            type="range"
            min="5"
            max="200"
            step="5"
            value={currentRaio}
            onChange={(e) => handleRaioChange(parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.raioPresets}>
            <button type="button" onClick={() => handleRaioChange(15)} className={currentRaio === 15 ? styles.active : ''}>15km</button>
            <button type="button" onClick={() => handleRaioChange(35)} className={currentRaio === 35 ? styles.active : ''}>35km</button>
            <button type="button" onClick={() => handleRaioChange(50)} className={currentRaio === 50 ? styles.active : ''}>50km</button>
            <button type="button" onClick={() => handleRaioChange(70)} className={currentRaio === 70 ? styles.active : ''}>70km</button>
            <button type="button" onClick={() => handleRaioChange(100)} className={currentRaio === 100 ? styles.active : ''}>100km</button>
            <button type="button" onClick={() => handleRaioChange(140)} className={currentRaio === 140 ? styles.active : ''}>140km</button>
          </div>
        </div>
      )}

      <div className={styles.areasList}>
        <h3>Áreas Configuradas ({areas.length}):</h3>
        {areas.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Nenhuma área configurada. Adicione uma cidade acima.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {areas.map((area, index) => {
              const color = areaColors[index % areaColors.length];
              return (
                <div
                  key={area.id}
                  style={{
                    padding: '0.75rem',
                    border: `2px solid ${selectedArea?.id === area.id ? color : '#e5e7eb'}`,
                    borderRadius: '8px',
                    background: selectedArea?.id === area.id ? `${color}15` : 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                  onClick={() => {
                    setSelectedArea(area);
                    setCurrentRaio(area.raioKm);
                    if (map) {
                      map.setCenter({ lat: area.latitude, lng: area.longitude });
                      map.setZoom(12);
                    }
                  }}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.875rem' }}>{area.cidade}</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      Raio: {area.raioKm}km • {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const updatedAreas = areas.filter(a => a.id !== area.id);
                      onAreasChange(updatedAreas);
                      if (selectedArea?.id === area.id) {
                        setSelectedArea(null);
                      }
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div ref={mapRef} className={styles.map} />

      <div className={styles.info}>
        <p>🗺️ <strong>Como usar:</strong></p>
        <ul>
          <li>Digite o nome da cidade no campo de busca e selecione nas sugestões</li>
          <li>Clique em uma área na lista para editá-la</li>
          <li>Arraste os marcadores no mapa para ajustar a posição</li>
          <li>Ajuste o raio usando o controle deslizante quando uma área estiver selecionada</li>
          <li>Clique em "Remover" para excluir uma área</li>
          <li>Cada área tem uma cor diferente no mapa</li>
        </ul>
      </div>
    </div>
  );
}

