/**
 * Calcula distância entre dois pontos geográficos usando fórmula de Haversine
 * @param lat1 - Latitude do ponto 1
 * @param lon1 - Longitude do ponto 1
 * @param lat2 - Latitude do ponto 2
 * @param lon2 - Longitude do ponto 2
 * @returns Distância em quilômetros com 2 casas decimais
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estima coordenadas baseado no CEP brasileiro
 * Usa tabela de faixas de CEP por cidade
 */
export function estimateCoordinatesFromCEP(
  cep: string, 
  city?: string, 
  state?: string
): { latitude: number; longitude: number } | null {
  const cleanCEP = cep.replace(/\D/g, '');
  
  if (cleanCEP.length !== 8) {
    return fallbackCoordinatesByCity(city, state);
  }

  const cepPrefix = parseInt(cleanCEP.substring(0, 5));
  
  // Tabela de coordenadas por faixa de CEP
  const cepRanges: { min: number; max: number; lat: number; lon: number; name: string }[] = [
    { min: 1000, max: 5999, lat: -23.5505, lon: -46.6333, name: 'São Paulo Centro' },
    { min: 6000, max: 8499, lat: -23.5329, lon: -46.7884, name: 'São Paulo Zona Oeste' },
    { min: 8500, max: 8899, lat: -23.6528, lon: -46.5547, name: 'São Paulo Zona Leste' },
    { min: 18000, max: 18999, lat: -23.5015, lon: -47.4526, name: 'Sorocaba' },
    { min: 20000, max: 23799, lat: -22.9068, lon: -43.1729, name: 'Rio de Janeiro' },
    { min: 70000, max: 72799, lat: -15.7801, lon: -47.9292, name: 'Brasília' },
    { min: 30000, max: 34999, lat: -19.9167, lon: -43.9345, name: 'Belo Horizonte' },
    { min: 60000, max: 61999, lat: -3.7172, lon: -38.5433, name: 'Fortaleza' },
    { min: 40000, max: 42599, lat: -12.9714, lon: -38.5014, name: 'Salvador' },
    { min: 80000, max: 82999, lat: -25.4284, lon: -49.2733, name: 'Curitiba' },
    { min: 90000, max: 94999, lat: -30.0346, lon: -51.2177, name: 'Porto Alegre' },
    { min: 50000, max: 54999, lat: -8.0476, lon: -34.8770, name: 'Recife' },
    { min: 69000, max: 69099, lat: -3.1190, lon: -60.0217, name: 'Manaus' },
  ];

  for (const range of cepRanges) {
    if (cepPrefix >= range.min && cepPrefix <= range.max) {
      const subRegion = parseInt(cleanCEP.substring(5, 8));
      const latVariation = (subRegion / 1000) * 0.05 - 0.025;
      const lonVariation = (subRegion / 1000) * 0.05 - 0.025;
      
      return {
        latitude: range.lat + latVariation,
        longitude: range.lon + lonVariation
      };
    }
  }

  return fallbackCoordinatesByCity(city, state);
}

function fallbackCoordinatesByCity(city?: string, state?: string): { latitude: number; longitude: number } | null {
  if (!city) return null;

  const cityCoords: Record<string, { lat: number; lon: number }> = {
    'São Paulo': { lat: -23.5505, lon: -46.6333 },
    'Sao Paulo': { lat: -23.5505, lon: -46.6333 }, // Variação comum
    'Sorocaba': { lat: -23.5015, lon: -47.4526 },
    'Rio de Janeiro': { lat: -22.9068, lon: -43.1729 },
    'Fortaleza': { lat: -3.7172, lon: -38.5433 },
    'Brasília': { lat: -15.7801, lon: -47.9292 },
    'Belo Horizonte': { lat: -19.9167, lon: -43.9345 },
    'Salvador': { lat: -12.9714, lon: -38.5014 },
    'Curitiba': { lat: -25.4284, lon: -49.2733 },
    'Porto Alegre': { lat: -30.0346, lon: -51.2177 },
    'Recife': { lat: -8.0476, lon: -34.8770 },
    'Manaus': { lat: -3.1190, lon: -60.0217 },
  };

  const normalizedCity = city.trim();
  return cityCoords[normalizedCity] 
    ? { latitude: cityCoords[normalizedCity].lat, longitude: cityCoords[normalizedCity].lon }
    : null;
}

/**
 * Extrai coordenadas de um objeto de endereço
 * Tenta usar CEP primeiro, depois cidade como fallback
 */
export function getCoordinatesFromAddress(address: any): { latitude: number; longitude: number } | null {
  if (!address) return null;

  const cep = address.zip || address.postal_code || address.cep || address.zipCode || address.postal_code;
  const city = address.city || address.cidade;
  const state = address.state || address.estado;

  if (cep) {
    return estimateCoordinatesFromCEP(cep, city, state);
  }

  return fallbackCoordinatesByCity(city, state);
}

