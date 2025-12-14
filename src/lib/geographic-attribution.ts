/**
 * Sistema de Atribuição Geográfica Automática
 * Atribui restaurantes a executivos baseado em localização geográfica
 */

import { calculateDistance } from './distance-calculator';
import { geocodeAddress, calculateRealDistance } from './google-maps';
import { prisma } from './db';

/**
 * Verifica se um ponto está dentro de um polígono
 * Algoritmo Ray Casting
 */
function pontoNoPoligono(
  ponto: { lat: number; lng: number },
  poligono: Array<{ lat: number; lng: number }>
): boolean {
  let dentro = false;
  const x = ponto.lat;
  const y = ponto.lng;
  
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].lat;
    const yi = poligono[i].lng;
    const xj = poligono[j].lat;
    const yj = poligono[j].lng;
    
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) dentro = !dentro;
  }
  
  return dentro;
}

/**
 * Calcula o centro geométrico de um polígono
 */
function calcularCentroPoligono(pontos: Array<{ lat: number; lng: number }>): { lat: number; lng: number } {
  const soma = pontos.reduce((acc, p) => ({
    lat: acc.lat + p.lat,
    lng: acc.lng + p.lng
  }), { lat: 0, lng: 0 });
  
  return {
    lat: soma.lat / pontos.length,
    lng: soma.lng / pontos.length
  };
}

/**
 * Busca executivos com território configurado
 */
async function buscarExecutivosComTerritorio() {
  return await prisma.seller.findMany({
    where: {
      territorioAtivo: true,
      OR: [
        { territorioTipo: 'raio' },
        { territorioTipo: 'poligono' },
        { areasCobertura: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      territorioTipo: true,
      baseCidade: true,
      baseLatitude: true,
      baseLongitude: true,
      raioKm: true,
      poligonoPontos: true,
      territorioAtivo: true,
      areasCobertura: true
    }
  });
}

/**
 * Salva coordenadas do restaurante no banco para cache
 */
async function salvarCoordenadasRestaurante(
  restauranteId: string,
  coordenadas: { lat: number; lng: number; fonte: string; place_id?: string; endereco_formatado?: string; [key: string]: any }
) {
  try {
    await prisma.restaurant.update({
      where: { id: restauranteId },
      data: {
        latitude: coordenadas.lat,
        longitude: coordenadas.lng,
        geocodingData: {
          ...coordenadas,
          atualizado_em: new Date().toISOString()
        } as any,
        geocodingAtualizadoEm: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao salvar coordenadas:', error);
  }
}


/**
 * Atribui automaticamente um restaurante a um executivo baseado em localização
 * 
 * @param restaurante - Dados do restaurante (deve ter CEP ou lat/lng)
 * @returns Resultado da atribuição
 */
export async function atribuirExecutivoAutomatico(restaurante: {
  id?: string;
  name?: string;
  address?: any;
  cep?: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{
  sucesso: boolean;
  executivo_id?: string;
  executivo_nome?: string;
  distancia_km?: number;
  metodo?: string;
  erro?: string;
  aviso?: string;
  alternativas?: Array<any>;
  coordenadas?: { lat: number; lng: number };
}> {
  try {
    // 1. Obter coordenadas do restaurante (usar cache se existir)
    let coordRestaurante: { lat: number; lng: number } | null = null;
    
    if (restaurante.latitude && restaurante.longitude) {
      // Usar coordenadas em cache
      coordRestaurante = {
        lat: restaurante.latitude,
        lng: restaurante.longitude
      };
    } else {
      // Buscar coordenadas via Google Maps API
      if (!restaurante.address) {
        return {
          sucesso: false,
          erro: 'Endereço não fornecido'
        };
      }
      
      const googleCoords = await geocodeAddress(restaurante.address);
      
      if (!googleCoords) {
        return {
          sucesso: false,
          erro: 'Não foi possível obter coordenadas do restaurante via Google Maps. Verifique se o endereço está correto e se a API Key está configurada.'
        };
      }
      
      coordRestaurante = {
        lat: googleCoords.latitude,
        lng: googleCoords.longitude
      };
      
      // Salvar coordenadas no banco para cache (se tiver ID)
      if (restaurante.id) {
        await salvarCoordenadasRestaurante(restaurante.id, {
          ...coordRestaurante,
          fonte: 'google_maps',
          endereco_formatado: restaurante.address
        });
      }
    }

    // 2. Buscar todos os executivos com território ativo
    const executivos = await buscarExecutivosComTerritorio();
    
    if (executivos.length === 0) {
      return {
        sucesso: false,
        erro: 'Nenhum executivo com território configurado'
      };
    }

    // 3. Verificar cada executivo e calcular distâncias
    const candidatos: Array<{
      executivo_id: string;
      executivo_nome: string;
      distancia_km: number;
      raio_km?: number | null;
      base_cidade?: string | null;
      metodo: string;
    }> = [];
    
    for (const exec of executivos) {
      if (!exec.territorioAtivo) continue;
      
      // Verificar múltiplas áreas primeiro
      if (exec.areasCobertura && Array.isArray(exec.areasCobertura) && exec.areasCobertura.length > 0) {
        for (const area of exec.areasCobertura) {
          if (!area.latitude || !area.longitude || !area.raioKm) continue;
          
          const distancia = calculateDistance(
            coordRestaurante.lat,
            coordRestaurante.lng,
            area.latitude,
            area.longitude
          );
          
          if (distancia <= area.raioKm) {
            candidatos.push({
              executivo_id: exec.id,
              executivo_nome: exec.name,
              distancia_km: distancia,
              raio_km: area.raioKm,
              base_cidade: area.cidade,
              metodo: 'raio_multiplas_areas'
            });
            break; // Encontrou uma área que cobre, não precisa verificar as outras
          }
        }
        continue; // Já verificou múltiplas áreas, passar para próximo executivo
      }
      
      if (exec.territorioTipo === 'raio') {
        if (!exec.baseLatitude || !exec.baseLongitude || !exec.raioKm) continue;
        
        const distancia = calculateDistance(
          coordRestaurante.lat,
          coordRestaurante.lng,
          Number(exec.baseLatitude),
          Number(exec.baseLongitude)
        );
        
        if (distancia <= exec.raioKm) {
          candidatos.push({
            executivo_id: exec.id,
            executivo_nome: exec.name,
            distancia_km: distancia,
            raio_km: exec.raioKm,
            base_cidade: exec.baseCidade,
            metodo: 'raio'
          });
        }
        
      } else if (exec.territorioTipo === 'poligono') {
        if (!exec.poligonoPontos) continue;
        
        try {
          const poligono = (exec.poligonoPontos as any).pontos || exec.poligonoPontos;
          const dentroDoPoligono = pontoNoPoligono(coordRestaurante, poligono);
          
          if (dentroDoPoligono) {
            // Calcular distância até centro do polígono para ordenação
            const centroPoligono = calcularCentroPoligono(poligono);
            const distancia = calculateDistance(
              coordRestaurante.lat,
              coordRestaurante.lng,
              centroPoligono.lat,
              centroPoligono.lng
            );
            
            candidatos.push({
              executivo_id: exec.id,
              executivo_nome: exec.name,
              distancia_km: distancia,
              base_cidade: exec.baseCidade,
              metodo: 'poligono'
            });
          }
        } catch (error) {
          console.error(`Erro ao processar polígono do executivo ${exec.name}:`, error);
        }
      }
    }

    // 4. Se nenhum candidato, retornar erro
    if (candidatos.length === 0) {
      return {
        sucesso: false,
        erro: 'Restaurante fora de todas as áreas de cobertura geográfica',
        coordenadas: coordRestaurante,
        sugestao: 'Verificar se algum executivo deve expandir seu território ou se as coordenadas estão corretas'
      };
    }

    // 5. Se múltiplos candidatos, escolher o mais próximo
    candidatos.sort((a, b) => a.distancia_km - b.distancia_km);
    const escolhido = candidatos[0];

    return {
      sucesso: true,
      executivo_id: escolhido.executivo_id,
      executivo_nome: escolhido.executivo_nome,
      distancia_km: escolhido.distancia_km,
      base_cidade: escolhido.base_cidade || undefined,
      metodo: escolhido.metodo,
      alternativas: candidatos.length > 1 ? candidatos.slice(1) : []
    };

  } catch (error: any) {
    console.error('Erro na atribuição automática:', error);
    return {
      sucesso: false,
      erro: error.message
    };
  }
}

/**
 * Processar importação da planilha com atribuição automática
 */
export async function processarImportacaoComAtribuicao(
  restaurantes: Array<{
    name: string;
    address?: any;
    cep?: string;
    [key: string]: any;
  }>
): Promise<{
  total: number;
  atribuidos: number;
  nao_atribuidos: number;
  erros: number;
  detalhes: Array<any>;
}> {
  const resultados = {
    total: restaurantes.length,
    atribuidos: 0,
    nao_atribuidos: 0,
    erros: 0,
    detalhes: [] as Array<any>
  };

  for (let i = 0; i < restaurantes.length; i++) {
    const restaurante = restaurantes[i];
    
    // Delay para respeitar rate limit (1 req/segundo)
    if (i > 0) await delay(1100);

    try {
      // Atribuir executivo
      const atribuicao = await atribuirExecutivoAutomatico({
        name: restaurante.name,
        address: restaurante.address,
        cep: restaurante.cep
      });

      if (atribuicao.sucesso) {
        resultados.atribuidos++;
        resultados.detalhes.push({
          restaurante: restaurante.name,
          executivo: atribuicao.executivo_nome,
          distancia: atribuicao.distancia_km,
          metodo: atribuicao.metodo
        });
      } else {
        resultados.nao_atribuidos++;
        resultados.detalhes.push({
          restaurante: restaurante.name,
          erro: atribuicao.erro
        });
      }

    } catch (error: any) {
      resultados.erros++;
      resultados.detalhes.push({
        restaurante: restaurante.name,
        erro: error.message
      });
    }
  }

  return resultados;
}

