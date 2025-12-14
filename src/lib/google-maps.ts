/**
 * Integração com Google Maps API
 * Usa Geocoding API para obter coordenadas e Distance Matrix API para calcular distâncias reais
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyASOKtEiW5F-NkwvjApo0NcMYab6OF3nlg';

/**
 * Obtém coordenadas (latitude/longitude) de um endereço usando Google Geocoding API
 */
export async function geocodeAddress(address: any): Promise<{ latitude: number; longitude: number } | null> {
  try {
    if (!address) return null;

    // Construir string de endereço
    const addressParts: string[] = [];
    
    if (address.street) addressParts.push(address.street);
    if (address.number) addressParts.push(address.number);
    if (address.neighborhood) addressParts.push(address.neighborhood);
    if (address.city) addressParts.push(address.city);
    if (address.state) addressParts.push(address.state);
    if (address.zip || address.cep || address.postal_code) {
      const cep = address.zip || address.cep || address.postal_code;
      addressParts.push(cep.replace(/\D/g, ''));
    }
    
    const addressString = addressParts.join(', ').trim();
    
    if (!addressString) return null;

    console.log(`   🌍 Geocoding: "${addressString}"`);

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${GOOGLE_MAPS_API_KEY}&region=br`
    );

    if (!response.ok) {
      console.warn(`   ⚠️ Erro na requisição de geocoding: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log(`   ✅ Coordenadas obtidas: ${location.lat}, ${location.lng}`);
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    } else {
      console.warn(`   ⚠️ Geocoding falhou: ${data.status} - ${data.error_message || 'Endereço não encontrado'}`);
      return null;
    }
  } catch (error: any) {
    console.error(`   ❌ Erro ao fazer geocoding:`, error.message);
    return null;
  }
}

/**
 * Calcula distância real entre dois pontos usando Google Distance Matrix API
 * Retorna distância em quilômetros e tempo estimado em minutos
 */
export async function calculateRealDistance(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&mode=${mode}&language=pt-BR&key=${GOOGLE_MAPS_API_KEY}&region=br`
    );

    if (!response.ok) {
      console.warn(`   ⚠️ Erro na requisição de distância: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.rows && data.rows.length > 0) {
      const element = data.rows[0].elements[0];
      
      if (element.status === 'OK') {
        // Converter metros para km
        const distanceKm = element.distance.value / 1000;
        // Converter segundos para minutos
        const durationMinutes = Math.round(element.duration.value / 60);
        
        return {
          distanceKm: Math.round(distanceKm * 100) / 100, // 2 casas decimais
          durationMinutes
        };
      } else {
        console.warn(`   ⚠️ Cálculo de distância falhou: ${element.status}`);
        return null;
      }
    } else {
      console.warn(`   ⚠️ Distance Matrix falhou: ${data.status} - ${data.error_message || 'Erro desconhecido'}`);
      return null;
    }
  } catch (error: any) {
    console.error(`   ❌ Erro ao calcular distância real:`, error.message);
    return null;
  }
}

/**
 * Calcula distâncias em lote (até 25 destinos por vez devido a limitações da API)
 * Retorna array de distâncias na mesma ordem dos destinos
 */
export async function calculateBatchDistances(
  origin: { latitude: number; longitude: number },
  destinations: Array<{ latitude: number; longitude: number; id: string }>,
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
): Promise<Array<{ id: string; distanceKm: number; durationMinutes: number }>> {
  try {
    // Google Distance Matrix API permite até 25 destinos por requisição
    const BATCH_SIZE = 25;
    const results: Array<{ id: string; distanceKm: number; durationMinutes: number }> = [];

    for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
      const batch = destinations.slice(i, i + BATCH_SIZE);
      const destsStr = batch.map(d => `${d.latitude},${d.longitude}`).join('|');
      const originStr = `${origin.latitude},${origin.longitude}`;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destsStr}&mode=${mode}&language=pt-BR&key=${GOOGLE_MAPS_API_KEY}&region=br`
      );

      if (!response.ok) {
        console.warn(`   ⚠️ Erro no batch ${i / BATCH_SIZE + 1}: ${response.status}`);
        // Adicionar valores nulos para este batch
        batch.forEach(d => {
          results.push({ id: d.id, distanceKm: Infinity, durationMinutes: Infinity });
        });
        continue;
      }

      const data = await response.json();

      if (data.status === 'OK' && data.rows && data.rows.length > 0) {
        const elements = data.rows[0].elements;
        
        batch.forEach((dest, idx) => {
          const element = elements[idx];
          if (element && element.status === 'OK') {
            const distanceKm = element.distance.value / 1000;
            const durationMinutes = Math.round(element.duration.value / 60);
            results.push({
              id: dest.id,
              distanceKm: Math.round(distanceKm * 100) / 100,
              durationMinutes
            });
          } else {
            // Se falhar, usar distância infinita para não considerar
            results.push({ id: dest.id, distanceKm: Infinity, durationMinutes: Infinity });
          }
        });
      } else {
        console.warn(`   ⚠️ Batch ${i / BATCH_SIZE + 1} falhou: ${data.status}`);
        batch.forEach(d => {
          results.push({ id: d.id, distanceKm: Infinity, durationMinutes: Infinity });
        });
      }

      // Rate limiting: aguardar 100ms entre batches para não exceder quota
      if (i + BATCH_SIZE < destinations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  } catch (error: any) {
    console.error(`   ❌ Erro ao calcular distâncias em lote:`, error.message);
    // Retornar distâncias infinitas em caso de erro
    return destinations.map(d => ({ id: d.id, distanceKm: Infinity, durationMinutes: Infinity }));
  }
}

/**
 * Obtém coordenadas de um endereço, tentando primeiro usar coordenadas existentes,
 * depois Google Geocoding API, e por último fallback para estimativa por CEP
 */
export async function getCoordinatesFromAddressWithGoogle(
  address: any,
  existingCoords?: { latitude: number | null; longitude: number | null }
): Promise<{ latitude: number; longitude: number } | null> {
  // 1. Se já tem coordenadas válidas, usar elas
  if (existingCoords?.latitude && existingCoords?.longitude) {
    return {
      latitude: existingCoords.latitude,
      longitude: existingCoords.longitude
    };
  }

  // 2. Tentar Google Geocoding API
  const googleCoords = await geocodeAddress(address);
  if (googleCoords) {
    return googleCoords;
  }

  // 3. Fallback para estimativa por CEP (importar do distance-calculator)
  const { getCoordinatesFromAddress } = await import('./distance-calculator');
  return getCoordinatesFromAddress(address);
}

