'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import styles from './TerritoryMapConfig.module.css';

interface TerritoryMapConfigProps {
  baseCidade?: string | null;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  raioKm?: number | null;
  onLocationChange: (data: {
    baseCidade: string;
    baseLatitude: number;
    baseLongitude: number;
    raioKm: number;
  }) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export default function TerritoryMapConfig({
  baseCidade,
  baseLatitude,
  baseLongitude,
  raioKm = 50,
  onLocationChange
}: TerritoryMapConfigProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [circle, setCircle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(baseCidade || '');
  const [currentRaio, setCurrentRaio] = useState(raioKm || 50);
  const [autocomplete, setAutocomplete] = useState<any>(null);

  // Carregar Google Maps
  useEffect(() => {
    const loadMap = async () => {
      try {
        // Buscar API Key do servidor
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

    const initialCenter = baseLatitude && baseLongitude
      ? { lat: baseLatitude, lng: baseLongitude }
      : { lat: -23.5505, lng: -46.6333 }; // São Paulo padrão

    const newMap = new window.google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom: baseLatitude && baseLongitude ? 12 : 10,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    setMap(newMap);

    // Adicionar marcador se tiver coordenadas
    if (baseLatitude && baseLongitude) {
      const newMarker = new window.google.maps.Marker({
        position: { lat: baseLatitude, lng: baseLongitude },
        map: newMap,
        draggable: true,
        title: 'Base do Executivo'
      });

      setMarker(newMarker);

      // Adicionar círculo do raio
      const newCircle = new window.google.maps.Circle({
        strokeColor: '#3498db',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3498db',
        fillOpacity: 0.2,
        map: newMap,
        center: { lat: baseLatitude, lng: baseLongitude },
        radius: (currentRaio || 50) * 1000 // converter km para metros
      });

      setCircle(newCircle);

      // Ajustar zoom para mostrar o círculo
      newMap.fitBounds(newCircle.getBounds());
    }

    // Configurar autocomplete para busca
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

          newMap.setCenter({ lat, lng });
          newMap.setZoom(12);

          // Atualizar marcador
          if (marker) {
            marker.setPosition({ lat, lng });
          } else {
            const newMarker = new window.google.maps.Marker({
              position: { lat, lng },
              map: newMap,
              draggable: true,
              title: 'Base do Executivo'
            });
            setMarker(newMarker);
          }

          // Atualizar círculo
          if (circle) {
            circle.setCenter({ lat, lng });
          } else {
            const newCircle = new window.google.maps.Circle({
              strokeColor: '#3498db',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#3498db',
              fillOpacity: 0.2,
              map: newMap,
              center: { lat, lng },
              radius: currentRaio * 1000
            });
            setCircle(newCircle);
          }

          // Notificar mudança
          onLocationChange({
            baseCidade: cityName,
            baseLatitude: lat,
            baseLongitude: lng,
            raioKm: currentRaio
          });
        }
      });
    }

    // Listener para arrastar marcador
    if (marker) {
      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        const lat = position.lat();
        const lng = position.lng();

        // Buscar endereço reverso
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results[0]) {
            const cityName = results[0].formatted_address;
            setSearchQuery(cityName);

            // Atualizar círculo
            if (circle) {
              circle.setCenter({ lat, lng });
            }

            // Notificar mudança
            onLocationChange({
              baseCidade: cityName,
              baseLatitude: lat,
              baseLongitude: lng,
              raioKm: currentRaio
            });
          }
        });
      });
    }

  }, [isLoading, baseLatitude, baseLongitude]);

  // Atualizar círculo quando raio mudar
  useEffect(() => {
    if (circle && currentRaio) {
      circle.setRadius(currentRaio * 1000);
      if (map) {
        map.fitBounds(circle.getBounds());
      }
    }
  }, [currentRaio, circle, map]);

  const handleRaioChange = (newRaio: number) => {
    setCurrentRaio(newRaio);
    if (marker) {
      const position = marker.getPosition();
      const lat = position.lat();
      const lng = position.lng();

      onLocationChange({
        baseCidade: searchQuery || baseCidade || '',
        baseLatitude: lat,
        baseLongitude: lng,
        raioKm: newRaio
      });
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
        <label htmlFor="city-search">📍 Buscar Cidade Base:</label>
        <input
          id="city-search"
          type="text"
          placeholder="Digite o nome da cidade (ex: Campinas, SP)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <p className={styles.hint}>💡 Digite o nome da cidade e selecione nas sugestões</p>
      </div>

      <div className={styles.raioControl}>
        <label htmlFor="raio-slider">Raio de Atendimento: <strong>{currentRaio} km</strong></label>
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

      <div ref={mapRef} className={styles.map} />

      <div className={styles.info}>
        <p>🗺️ <strong>Como usar:</strong></p>
        <ul>
          <li>Digite o nome da cidade no campo de busca</li>
          <li>Selecione a cidade nas sugestões</li>
          <li>Arraste o marcador azul para ajustar a posição</li>
          <li>Ajuste o raio usando o controle deslizante</li>
          <li>O círculo azul mostra a área de cobertura</li>
        </ul>
      </div>
    </div>
  );
}

