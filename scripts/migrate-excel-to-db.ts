// scripts/migrate-excel-to-db.ts
import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Encontra o vendedor responsável pela região do restaurante
 */
async function findSellerForRegion(city: string): Promise<string | null> {
  if (!city || city === 'N/A') return null;
  
  const sellers = await prisma.seller.findMany({
    where: { active: true }
  });
  
  for (const seller of sellers) {
    const regions = seller.regions as string[];
    if (regions.some(region => 
      city.toLowerCase().includes(region.toLowerCase()) || 
      region.toLowerCase().includes(city.toLowerCase())
    )) {
      return seller.id;
    }
  }
  
  return null;
}

/**
 * Importa uma planilha Excel para o banco de dados
 */
async function importExcelFile(filePath: string, fileName: string) {
  console.log(`\n📄 Processando: ${fileName}`);
  
  try {
    const buffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<any>(sheet);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const row of rows) {
      try {
        // Extrair TODOS os comentários (busca dinâmica em todas as colunas)
        const comments: string[] = [];
        
        // Método 1: Buscar colunas "Comentário X" (até 200 para garantir)
        for (let i = 1; i <= 200; i++) {
          const comment = row[`Comentário ${i}`];
          if (comment && comment.toString().trim()) {
            comments.push(comment.toString().trim());
          }
        }
        
        // Método 2: Buscar outras variações de nome de coluna
        const commentVariations = [
          'Comentarios', 'Comentários', 'Comentario', 'Comentário',
          'Comentario 1', 'Comentários 1', 'Comentario1', 'Comentários1'
        ];
        
        for (const variation of commentVariations) {
          const comment = row[variation];
          if (comment && comment.toString().trim() && !comments.includes(comment.toString().trim())) {
            comments.push(comment.toString().trim());
          }
        }
        
        // Método 3: Buscar em todas as colunas que contenham "coment" no nome
        for (const key in row) {
          if (key.toLowerCase().includes('coment') && row[key]) {
            const comment = row[key].toString().trim();
            if (comment && !comments.includes(comment)) {
              comments.push(comment);
            }
          }
        }
        
        // Verificar se já existe (por nome e cidade para evitar duplicatas)
        const city = row['Cidade'] || '';
        const name = row['Nome'] || 'Unknown';
        
        const existing = await prisma.restaurant.findFirst({
          where: {
            name: name,
            address: {
              path: ['city'],
              equals: city
            }
          }
        });
        
        if (existing) {
          console.log(`  ⏭️  Já existe: ${name} - ${city}`);
          skipped++;
          continue;
        }
        
        // Encontrar vendedor responsável
        const sellerId = await findSellerForRegion(city);
        
        // Gerar código de cliente único
        const maxCodigo = await prisma.restaurant.findFirst({
          where: { codigoCliente: { not: null } },
          orderBy: { codigoCliente: 'desc' },
          select: { codigoCliente: true }
        });
        const codigoCliente = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : 10000;
        
        // Criar restaurante
        const restaurant = await prisma.restaurant.create({
          data: {
            name: name,
            codigoCliente: codigoCliente,
            rating: parseFloat(row['Avaliação']) || 0,
            reviewCount: parseInt(row['Nº Avaliações']) || 0,
            totalComments: parseInt(row['Total Comentários']) || 0,
            projectedDeliveries: parseInt(row['Projeção Entregas/Mês']) || 0,
            salesPotential: row['Potencial Vendas'] || 'N/A',
            category: row['Categoria'] || 'N/A',
            address: {
              street: row['Endereço (Rua)'] || '',
              neighborhood: row['Bairro'] || '',
              city: city,
              state: row['Estado'] || '',
              zip: row['CEP'] || '',
            },
            lastCollectionDate: row['Data Coleta'] ? new Date(row['Data Coleta']) : null,
            status: row['Potencial Vendas'] === 'ALTÍSSIMO' ? 'Qualificado' : 'A Analisar',
            sourceFile: fileName,
            sellerId: sellerId,
            assignedAt: sellerId ? new Date() : null,
            comments: {
              create: comments.map(content => ({ content }))
            }
          }
        });
        
        imported++;
        console.log(`  ✅ Importado: ${name} - ${city}${sellerId ? ' (Vendedor atribuído)' : ''}`);
        
      } catch (error: any) {
        errors++;
        console.error(`  ❌ Erro ao importar linha:`, error.message);
      }
    }
    
    console.log(`\n📊 Resumo de ${fileName}:`);
    console.log(`   ✅ Importados: ${imported}`);
    console.log(`   ⏭️  Ignorados (duplicados): ${skipped}`);
    console.log(`   ❌ Erros: ${errors}`);
    
    return { imported, skipped, errors };
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar ${fileName}:`, error.message);
    return { imported: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Importa todas as planilhas de uma pasta
 */
async function importAllExcelFiles(folderPath: string) {
  console.log('🚀 Iniciando migração de planilhas Excel para o banco de dados...\n');
  
  if (!fs.existsSync(folderPath)) {
    console.error(`❌ Pasta não encontrada: ${folderPath}`);
    return;
  }
  
  const files = fs.readdirSync(folderPath)
    .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'));
  
  if (files.length === 0) {
    console.log('⚠️  Nenhuma planilha encontrada na pasta.');
    return;
  }
  
  console.log(`📁 Encontradas ${files.length} planilhas\n`);
  
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const result = await importExcelFile(filePath, file);
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO GERAL:');
  console.log(`   ✅ Total importados: ${totalImported}`);
  console.log(`   ⏭️  Total ignorados: ${totalSkipped}`);
  console.log(`   ❌ Total erros: ${totalErrors}`);
  console.log('='.repeat(50));
}

/**
 * Cria vendedores padrão se não existirem
 */
async function createDefaultSellers() {
  console.log('\n👥 Verificando vendedores...');
  
  const sellers = await prisma.seller.findMany();
  
  if (sellers.length === 0) {
    console.log('📝 Criando vendedores padrão...');
    
    const defaultSellers = [
      {
        name: 'Vendedor 1',
        email: 'vendedor1@ymbale.com',
        phone: '',
        regions: ['Sorocaba', 'Votorantim'],
        active: true
      },
      {
        name: 'Vendedor 2',
        email: 'vendedor2@ymbale.com',
        phone: '',
        regions: ['São Paulo', 'Guarulhos'],
        active: true
      },
      {
        name: 'Vendedor 3',
        email: 'vendedor3@ymbale.com',
        phone: '',
        regions: ['Campinas', 'Valinhos'],
        active: true
      },
      {
        name: 'Vendedor 4',
        email: 'vendedor4@ymbale.com',
        phone: '',
        regions: ['Ribeirão Preto', 'Sertãozinho'],
        active: true
      },
      {
        name: 'Vendedor 5',
        email: 'vendedor5@ymbale.com',
        phone: '',
        regions: ['Outros'], // Vendedor para outras regiões
        active: true
      }
    ];
    
    for (const sellerData of defaultSellers) {
      await prisma.seller.create({ data: sellerData });
      console.log(`  ✅ Criado: ${sellerData.name} - Regiões: ${sellerData.regions.join(', ')}`);
    }
  } else {
    console.log(`  ✅ ${sellers.length} vendedor(es) já cadastrado(s)`);
  }
}

/**
 * Função principal
 */
async function main() {
  try {
    // Criar vendedores padrão
    await createDefaultSellers();
    
    // Importar planilhas
    const dataFolder = path.join(process.cwd(), 'data');
    await importAllExcelFiles(dataFolder);
    
    console.log('\n🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main();

