# 🗺️ Sistema de Atribuição Geográfica por Coordenadas

## 📋 Visão Geral

Este sistema substitui o método manual de atribuição por CEPs por um sistema automático baseado em coordenadas geográficas, eliminando a necessidade de cadastrar manualmente zonas e CEPs.

### ✅ Benefícios

- **Zero manutenção**: Não precisa cadastrar CEPs/zonas manualmente
- **Cobertura automática**: Novas cidades são cobertas automaticamente
- **Precisão geográfica**: Usa localização real, não ranges de CEP
- **Escalável**: Funciona com 10 ou 10.000 restaurantes
- **Flexível**: Ajustar raio é instantâneo

## 🚀 Instalação e Configuração

### 1. Executar Migração do Banco de Dados

```bash
# Opção 1: Usar SQL direto (recomendado)
psql -U seu_usuario -d seu_banco -f prisma/migrations/add-geographic-territory.sql

# Opção 2: Usar Prisma (se preferir)
npx prisma db push
```

### 2. Popular Territórios dos Executivos

Execute o script para configurar os territórios pré-definidos:

```bash
npm run populate-territories
```

Este script configura automaticamente:
- **Celio Fernando**: Sorocaba (raio 100km)
- **Cícero**: Santo André (raio 15km)
- **Glauber**: Campinas (raio 70km)
- **Reginaldo**: SP Zona Leste (raio 140km)
- **João Santana**: SP Centro (raio 35km)

### 3. Regenerar Prisma Client

Após as migrações:

```bash
npx prisma generate
```

## 🧪 Testes

Execute o script de testes para validar o sistema:

```bash
npm run test-attribution
```

Este script testa a atribuição com endereços conhecidos e verifica se os executivos corretos são atribuídos.

## 📖 Como Funciona

### Fluxo de Atribuição

1. **Sistema Legado (CEP)**: Primeiro tenta encontrar zona por CEP
2. **Atribuição Geográfica**: Se não encontrar, usa coordenadas geográficas
3. **Fallback**: Se nenhum método funcionar, restaurante fica sem atribuição

### Tipos de Território

#### 1. Raio de Distância (Atual)
- Define uma cidade base e um raio em km
- Todos os restaurantes dentro do raio são atribuídos automaticamente
- Exemplo: Campinas com raio de 70km cobre toda a RMC

#### 2. Polígono (Futuro)
- Define uma área personalizada com múltiplos pontos
- Útil para áreas irregulares ou que não seguem um círculo
- Ainda não implementado na interface

#### 3. CEP Legado
- Mantém compatibilidade com sistema antigo
- Usado como fallback quando território geográfico não encontra resultado

## 🔧 Configuração de Executivos

### Via SQL

```sql
UPDATE sellers SET 
  territorio_tipo = 'raio',
  base_cidade = 'Sua Cidade, SP',
  base_latitude = -23.5505,
  base_longitude = -46.6333,
  raio_km = 50,
  territorio_ativo = TRUE
WHERE name = 'Nome do Executivo';
```

### Via Interface (Futuro)

A interface de configuração será implementada na página de edição de executivos.

## 📊 APIs Utilizadas

### ViaCEP (Gratuito)
- Busca dados do CEP (logradouro, bairro, cidade, estado)
- Sem necessidade de API Key
- Rate limit: ~10 requisições/segundo

### Nominatim / OpenStreetMap (Gratuito)
- Geocoding (conversão de endereço para coordenadas)
- Sem necessidade de API Key
- Rate limit: 1 requisição/segundo (respeitado automaticamente)

## 🔍 Monitoramento

### Verificar Executivos Configurados

```sql
SELECT 
  name,
  territorio_tipo,
  base_cidade,
  raio_km,
  territorio_ativo
FROM sellers
WHERE territorio_ativo = TRUE;
```

### Verificar Restaurantes Atribuídos

```sql
SELECT 
  r.name,
  s.name as executivo,
  r.latitude,
  r.longitude,
  s.base_cidade,
  s.raio_km
FROM restaurants r
INNER JOIN sellers s ON r.seller_id = s.id
WHERE s.territorio_tipo = 'raio'
ORDER BY s.name, r.name;
```

## 🐛 Troubleshooting

### "Coordenadas não encontradas"

- Verificar se CEP está correto
- Tentar com endereço completo
- Sistema usa fallback para apenas cidade se CEP falhar

### "Rate limit excedido"

- O sistema já adiciona delay automático (1100ms entre requisições)
- Se necessário, aumentar delay no arquivo `src/lib/geocoding.ts`

### "Nenhum executivo encontrado"

- Verificar se executivos têm `territorio_ativo = TRUE`
- Verificar se raios estão configurados
- Verificar se coordenadas do restaurante são válidas

### Restaurantes não sendo atribuídos

1. Verificar se coordenadas foram populadas:
   ```bash
   npm run debug-coords
   ```

2. Verificar se executivos têm território configurado:
   ```bash
   npm run populate-territories
   ```

3. Testar atribuição manual:
   ```bash
   npm run test-attribution
   ```

## 📝 Estrutura de Arquivos

```
src/lib/
  ├── geocoding.ts                    # Funções de geocoding (ViaCEP + Nominatim)
  ├── geographic-attribution.ts        # Lógica de atribuição automática
  └── distance-calculator.ts          # Cálculo de distâncias (Haversine)

src/scripts/
  ├── populate-executive-territories.ts  # Script para popular territórios
  └── test-geographic-attribution.ts     # Script de testes

prisma/
  └── migrations/
      └── add-geographic-territory.sql  # SQL de migração
```

## 🔄 Migração do Sistema Antigo

### Fase 1: Coexistência (2-4 semanas)
- Sistema antigo continua funcionando
- Novo sistema funciona em paralelo
- Flag `territorio_ativo` permite escolher qual usar

### Fase 2: Transição (1-2 semanas)
- Ativar território geográfico para todos os executivos
- Sistema tenta primeiro por coordenadas
- Se falhar, usa CEP legado como fallback

### Fase 3: Descontinuação (após validação)
- Remover código de zonas CEP antigas
- Limpar tabelas desnecessárias
- Sistema 100% baseado em coordenadas

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs no console do servidor
2. Executar scripts de teste e debug
3. Consultar documentação das APIs:
   - ViaCEP: https://viacep.com.br/
   - Nominatim: https://nominatim.org/release-docs/latest/api/Search/

## 🎯 Próximos Passos

- [ ] Interface de configuração de território na página de executivos
- [ ] Suporte a polígonos na interface
- [ ] Dashboard de cobertura de território
- [ ] Relatórios de distribuição geográfica
- [ ] Integração com Google Maps para visualização

