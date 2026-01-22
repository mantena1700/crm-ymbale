# 📥 MÓDULO 3: IMPORTAÇÃO DE DADOS

## Objetivo
Implementar sistema completo de importação de dados Excel/TXT com atribuição automática.

## Passos de Implementação

### 1. Instalar Dependências

```bash
npm install xlsx exceljs
```

### 2. Criar Helper de Extração de Colunas

**Arquivo:** `src/app/actions-import-helper.ts`

```typescript
export function getColumnValue(row: any, possibleNames: string[]): any {
  // 1. Tentar busca exata
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }

  // 2. Tentar busca case-insensitive
  const rowKeys = Object.keys(row);
  for (const possibleName of possibleNames) {
    const found = rowKeys.find(key => {
      const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedName = possibleName.toLowerCase().trim().replace(/\s+/g, ' ');
      return normalizedKey === normalizedName ||
             normalizedKey.includes(normalizedName) ||
             normalizedName.includes(normalizedKey);
    });
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
      return row[found];
    }
  }

  return null;
}
```

### 3. Criar Função de Mapeamento

**Arquivo:** `src/app/actions-import-helper.ts`

```typescript
export function mapRestaurantFields(row: any, comments: string[]) {
  return {
    name: getColumnValue(row, ['Nome', 'nome', 'Restaurante']) || 'Unknown',
    city: getColumnValue(row, ['Cidade', 'cidade', 'City']) || '',
    cep: getColumnValue(row, ['CEP', 'Zip Code', 'Código Postal']) || '',
    rating: parseFloat(getColumnValue(row, ['Avaliação', 'Rating']) || '0'),
    reviewCount: parseInt(getColumnValue(row, ['Nº Avaliações', 'Review Count']) || '0'),
    totalComments: parseInt(getColumnValue(row, ['Total Comentários', 'Total Comments']) || '0'),
    projectedDeliveries: parseInt(getColumnValue(row, ['Projeção Entregas/Mês', 'Projected Deliveries']) || '0'),
    salesPotential: getColumnValue(row, ['Potencial Vendas', 'Sales Potential']) || 'N/A',
    address: {
      street: getColumnValue(row, ['Endereço (Rua)', 'Street', 'Rua']) || '',
      neighborhood: getColumnValue(row, ['Bairro', 'Neighborhood', 'Bairro']) || '',
      city: getColumnValue(row, ['Cidade', 'City']) || '',
      state: getColumnValue(row, ['Estado', 'State']) || '',
      zip: getColumnValue(row, ['CEP', 'Zip Code']) || ''
    },
    comments: comments,
    lastCollectionDate: getColumnValue(row, ['Data Coleta', 'Collection Date']) 
      ? new Date(getColumnValue(row, ['Data Coleta', 'Collection Date']))
      : null
  };
}
```

### 4. Criar Função de Normalização de CEP

```typescript
function normalizeCep(cep: string): string {
  // Remover caracteres especiais
  let normalized = cep.replace(/[^\d]/g, '');
  
  // Adicionar hífen se necessário
  if (normalized.length === 8) {
    normalized = normalized.slice(0, 5) + '-' + normalized.slice(5);
  }
  
  return normalized;
}

function extractCepFromAddress(address: string): string | null {
  // Regex para encontrar CEP no formato 12345-678 ou 12345678
  const cepRegex = /\b\d{5}-?\d{3}\b/;
  const match = address.match(cepRegex);
  return match ? normalizeCep(match[0]) : null;
}
```

### 5. Criar Função de Geração de Código de Cliente

```typescript
async function getNextCodigoCliente(): Promise<number> {
  const maxCodigo = await prisma.restaurant.findFirst({
    where: { codigoCliente: { not: null } },
    orderBy: { codigoCliente: 'desc' },
    select: { codigoCliente: true }
  });
  
  const startCode = 10000;
  const nextCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : startCode;
  
  return Math.max(nextCode, startCode);
}
```

### 6. Criar Server Action de Importação

**Arquivo:** `src/app/actions.ts`

```typescript
export async function importExcelFile(formData: FormData) {
  'use server';
  
  // 1. Obter arquivos do FormData
  const files = formData.getAll('files') as File[];
  
  // 2. Inicializar contadores
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  // 3. Para cada arquivo
  for (const file of files) {
    try {
      // 3.1. Parsear arquivo
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json<any>(sheet);
      
      // 3.2. Para cada linha
      for (const row of rows) {
        try {
          // 3.2.1. Extrair comentários
          const comments: string[] = [];
          for (const key in row) {
            if (key.toLowerCase().includes('coment') && row[key]) {
              const comment = row[key].toString().trim();
              if (comment && !comments.includes(comment)) {
                comments.push(comment);
              }
            }
          }
          
          // 3.2.2. Mapear campos
          const mapped = mapRestaurantFields(row, comments);
          
          // 3.2.3. Verificar duplicatas
          const existing = await prisma.restaurant.findFirst({
            where: {
              name: mapped.name,
              address: { path: ['city'], equals: mapped.city }
            }
          });
          
          if (existing) {
            totalSkipped++;
            continue;
          }
          
          // 3.2.4. Normalizar CEP
          let cep = mapped.cep ? normalizeCep(mapped.cep) : '';
          if (!cep && mapped.address.street) {
            cep = extractCepFromAddress(mapped.address.street) || '';
          }
          
          // 3.2.5. Gerar código de cliente
          const codigoCliente = await getNextCodigoCliente();
          
          // 3.2.6. Atribuir zona (sistema legado - opcional)
          let zonaId: string | null = null;
          if (cep) {
            const zona = await findZonaByCep(cep);
            if (zona) zonaId = zona.id;
          }
          
          // 3.2.7. Atribuir executivo
          let sellerId: string | null = null;
          if (zonaId) {
            const seller = await findSellerByZona(zonaId);
            if (seller) sellerId = seller.id;
          } else {
            // Tentar atribuição geográfica
            const atribuicao = await atribuirExecutivoAutomatico({
              address: mapped.address,
              cep: cep
            });
            if (atribuicao.sucesso) {
              sellerId = atribuicao.executivo_id;
              // Salvar coordenadas se disponíveis
              if (atribuicao.coordenadas) {
                mapped.latitude = atribuicao.coordenadas.lat;
                mapped.longitude = atribuicao.coordenadas.lng;
              }
            }
          }
          
          // 3.2.8. Criar restaurante
          const restaurant = await prisma.restaurant.create({
            data: {
              name: mapped.name,
              codigoCliente: codigoCliente,
              rating: mapped.rating,
              reviewCount: mapped.reviewCount,
              totalComments: mapped.totalComments,
              projectedDeliveries: mapped.projectedDeliveries,
              salesPotential: mapped.salesPotential,
              address: mapped.address,
              lastCollectionDate: mapped.lastCollectionDate,
              status: mapped.salesPotential === 'ALTÍSSIMO' ? 'Qualificado' : 'A Analisar',
              sourceFile: file.name,
              sellerId: sellerId,
              assignedAt: sellerId ? new Date() : null,
              latitude: mapped.latitude,
              longitude: mapped.longitude,
              comments: {
                create: comments.map(content => ({ content }))
              }
            }
          });
          
          totalImported++;
          
        } catch (error) {
          console.error('Erro ao importar linha:', error);
          totalErrors++;
        }
      }
      
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      totalErrors++;
    }
  }
  
  // 4. Invalidar cache
  revalidatePath('/clients');
  revalidatePath('/pipeline');
  revalidatePath('/carteira');
  
  // 5. Retornar resumo
  return {
    success: true,
    imported: totalImported,
    skipped: totalSkipped,
    errors: totalErrors
  };
}
```

### 7. Criar Interface de Upload

**Arquivo:** `src/app/clients/page.tsx` ou componente separado

**Funcionalidades:**
- Input de arquivo (múltiplos)
- Drag & drop
- Preview de arquivos selecionados
- Botão de importar
- Feedback de progresso
- Exibir resumo após importação

### 8. Suporte a Arquivo TXT (Opcional)

```typescript
async function parseTextFile(file: File): Promise<any[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  
  // Detectar delimitador
  const delimiter = text.includes('|') ? '|' : 
                   text.includes(';') ? ';' : 
                   text.includes('\t') ? '\t' : ',';
  
  // Verificar se tem cabeçalho
  const hasHeader = lines[0].toLowerCase().includes('nome');
  
  const startIndex = hasHeader ? 1 : 0;
  const rows = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    const row: any = {};
    
    // Mapear valores (assumindo ordem padrão ou usar cabeçalho)
    // ...
    
    rows.push(row);
  }
  
  return rows;
}
```

## Validações

1. **Formato de Arquivo:** Aceitar apenas .xlsx, .xls, .txt
2. **Tamanho:** Limitar tamanho do arquivo (ex: 10MB)
3. **Colunas Obrigatórias:** Nome e Cidade (mínimo)
4. **CEP:** Validar formato após normalização
5. **Duplicatas:** Verificar antes de criar

## Tratamento de Erros

1. **Arquivo inválido:** Retornar erro específico
2. **Linha com erro:** Registrar e continuar
3. **Falha na atribuição:** Continuar sem executivo
4. **Erro de parsing:** Registrar e pular linha

## Testes

1. Importar arquivo Excel válido
2. Importar arquivo com duplicatas
3. Importar arquivo com CEPs inválidos
4. Importar arquivo sem colunas obrigatórias
5. Importar múltiplos arquivos
6. Verificar atribuição automática

## Próximo Módulo

Após concluir este módulo, seguir para: **MÓDULO 4: ATRIBUIÇÃO GEOGRÁFICA**
