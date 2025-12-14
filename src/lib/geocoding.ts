/**
 * Sistema de Geocoding usando ViaCEP + Nominatim (OpenStreetMap)
 * GRATUITO - Sem necessidade de API Key
 */

/**
 * Obtém coordenadas (latitude/longitude) a partir de um CEP ou endereço
 * Usa ViaCEP + Nominatim (OpenStreetMap) - GRATUITO
 * 
 * @param cep - CEP no formato 12345-678 ou 12345678
 * @param endereco - Endereço completo (opcional, melhora precisão)
 * @returns Promise com coordenadas ou null
 */
export async function obterCoordenadas(
  cep: string,
  endereco?: string | null
): Promise<{ lat: number; lng: number; fonte: string; endereco_normalizado?: string; dados_cep?: any } | null> {
  try {
    // Limpar CEP
    const cepLimpo = cep.replace(/[^0-9]/g, '');
    
    if (cepLimpo.length !== 8) {
      throw new Error('CEP inválido');
    }

    // 1. Buscar dados do CEP no ViaCEP
    const viaCepResponse = await fetch(
      `https://viacep.com.br/ws/${cepLimpo}/json/`,
      {
        headers: {
          'User-Agent': 'CRM-Restaurantes/1.0'
        }
      }
    );
    
    if (!viaCepResponse.ok) {
      throw new Error('Erro ao consultar ViaCEP');
    }
    
    const dadosCep = await viaCepResponse.json();
    
    if (dadosCep.erro) {
      throw new Error('CEP não encontrado');
    }

    // 2. Montar endereço para geocoding
    let enderecoCompleto: string;
    if (endereco) {
      enderecoCompleto = endereco;
    } else {
      enderecoCompleto = `${dadosCep.logradouro || ''}, ${dadosCep.bairro || ''}, ${dadosCep.localidade || ''}, ${dadosCep.uf || ''}, Brasil`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',');
    }

    // 3. Buscar coordenadas no Nominatim (OpenStreetMap)
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?` + 
      `q=${encodeURIComponent(enderecoCompleto)}&` +
      `format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CRM-Restaurantes/1.0'
        }
      }
    );
    
    if (!nominatimResponse.ok) {
      throw new Error('Erro ao consultar Nominatim');
    }
    
    const coordenadas = await nominatimResponse.json();
    
    if (!coordenadas || coordenadas.length === 0) {
      throw new Error('Coordenadas não encontradas');
    }

    const resultado = {
      lat: parseFloat(coordenadas[0].lat),
      lng: parseFloat(coordenadas[0].lon),
      fonte: 'nominatim',
      endereco_normalizado: enderecoCompleto,
      dados_cep: dadosCep
    };

    return resultado;

  } catch (error: any) {
    console.error('Erro ao obter coordenadas:', error);
    
    // Fallback: tentar apenas com cidade e estado
    try {
      // Tentar buscar cidade do CEP novamente
      const cepLimpo = cep.replace(/[^0-9]/g, '');
      const viaCepResponse = await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`
      );
      
      if (viaCepResponse.ok) {
        const dadosCep = await viaCepResponse.json();
        
        if (!dadosCep.erro && dadosCep.localidade && dadosCep.uf) {
          const fallbackResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `city=${encodeURIComponent(dadosCep.localidade)}&state=${encodeURIComponent(dadosCep.uf)}&country=Brasil&` +
            `format=json&limit=1`,
            {
              headers: {
                'User-Agent': 'CRM-Restaurantes/1.0'
              }
            }
          );
          
          const fallbackCoords = await fallbackResponse.json();
          
          if (fallbackCoords && fallbackCoords.length > 0) {
            return {
              lat: parseFloat(fallbackCoords[0].lat),
              lng: parseFloat(fallbackCoords[0].lon),
              fonte: 'nominatim_cidade',
              precisao: 'baixa'
            };
          }
        }
      }
    } catch (fallbackError) {
      console.error('Fallback também falhou:', fallbackError);
    }
    
    return null;
  }
}

/**
 * IMPORTANTE: Adicionar delay entre requisições para respeitar rate limit
 * Nominatim: máximo 1 requisição por segundo
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extrai CEP de um endereço completo
 */
export function extrairCEP(endereco: string | null | undefined): string | null {
  if (!endereco) return null;
  const match = endereco.match(/\d{5}-?\d{3}/);
  return match ? match[0] : null;
}

