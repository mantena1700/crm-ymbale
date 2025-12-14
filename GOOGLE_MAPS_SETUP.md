# Configuração Google Maps API

## Chave de API

A chave de API do Google Maps está configurada no código como fallback:
```
AIzaSyASOKtEiW5F-NkwvjApo0NcMYab6OF3nlg
```

## Configuração Recomendada (Variável de Ambiente)

Para maior segurança, recomenda-se adicionar a chave em uma variável de ambiente:

1. Crie um arquivo `.env.local` na raiz do projeto:
```env
GOOGLE_MAPS_API_KEY=AIzaSyASOKtEiW5F-NkwvjApo0NcMYab6OF3nlg
```

2. O código já está preparado para ler de `process.env.GOOGLE_MAPS_API_KEY`

## APIs Utilizadas

### 1. Geocoding API
- **Uso**: Obter coordenadas (latitude/longitude) de endereços
- **Endpoint**: `https://maps.googleapis.com/maps/api/geocode/json`
- **Quota**: 40.000 requisições/mês (gratuito)

### 2. Distance Matrix API
- **Uso**: Calcular distâncias e tempos reais entre pontos
- **Endpoint**: `https://maps.googleapis.com/maps/api/distancematrix/json`
- **Quota**: 40.000 requisições/mês (gratuito)
- **Limite**: 25 destinos por requisição

## Funcionalidades Implementadas

1. **Geocoding de Endereços**
   - Obtém coordenadas precisas usando Google Geocoding API
   - Fallback para estimativa por CEP se API falhar

2. **Cálculo de Distâncias Reais**
   - Usa Google Distance Matrix API para distâncias reais de rota
   - Calcula em lote (até 25 destinos por vez)
   - Retorna distância em km e tempo estimado em minutos
   - Fallback para fórmula Haversine se API falhar

3. **Preenchimento Inteligente**
   - Usa distâncias reais para agrupar restaurantes próximos
   - Considera tempo de viagem real (não apenas distância em linha reta)
   - Prioriza restaurantes com menor tempo de viagem

## Rate Limiting

O código implementa um delay de 100ms entre batches de requisições para evitar exceder a quota da API.

## Custos

- **Gratuito**: Até 40.000 requisições/mês por API
- **Pago**: $5 por 1.000 requisições adicionais (após o limite gratuito)

## Monitoramento

Verifique o uso da API no [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)

