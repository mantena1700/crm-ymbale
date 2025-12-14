/**
 * Script para executar migração SQL diretamente no banco
 * Usa Prisma para executar comandos SQL raw
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function executeMigration() {
  console.log('📦 Executando migração do banco de dados...\n');

  try {
    // 1. Adicionar campos na tabela sellers
    console.log('1️⃣ Adicionando campos na tabela sellers...');
    
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE sellers 
        ADD COLUMN IF NOT EXISTS territorio_tipo VARCHAR(20) DEFAULT 'cep_legado',
        ADD COLUMN IF NOT EXISTS base_cidade VARCHAR(200) NULL,
        ADD COLUMN IF NOT EXISTS base_latitude DECIMAL(10, 8) NULL,
        ADD COLUMN IF NOT EXISTS base_longitude DECIMAL(11, 8) NULL,
        ADD COLUMN IF NOT EXISTS raio_km INT NULL,
        ADD COLUMN IF NOT EXISTS poligono_pontos JSONB NULL,
        ADD COLUMN IF NOT EXISTS territorio_ativo BOOLEAN DEFAULT TRUE
      `);
      console.log('   ✅ Campos adicionados na tabela sellers\n');
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('   ⏭️  Campos já existem na tabela sellers\n');
      } else {
        throw error;
      }
    }

    // 2. Adicionar campos na tabela restaurants
    console.log('2️⃣ Adicionando campos na tabela restaurants...');
    
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE restaurants 
        ADD COLUMN IF NOT EXISTS geocoding_data JSONB NULL,
        ADD COLUMN IF NOT EXISTS geocoding_atualizado_em TIMESTAMPTZ NULL
      `);
      console.log('   ✅ Campos adicionados na tabela restaurants\n');
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('   ⏭️  Campos já existem na tabela restaurants\n');
      } else {
        throw error;
      }
    }

    // 3. Criar índices
    console.log('3️⃣ Criando índices...');
    
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_restaurants_coords 
        ON restaurants(latitude, longitude) 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      `);
      console.log('   ✅ Índice idx_restaurants_coords criado');
    } catch (error: any) {
      console.log('   ⏭️  Índice idx_restaurants_coords já existe ou erro (ignorando)');
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sellers_territorio_ativo 
        ON sellers(territorio_ativo) 
        WHERE territorio_ativo = TRUE
      `);
      console.log('   ✅ Índice idx_sellers_territorio_ativo criado');
    } catch (error: any) {
      console.log('   ⏭️  Índice idx_sellers_territorio_ativo já existe ou erro (ignorando)');
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_sellers_territorio_tipo 
        ON sellers(territorio_tipo)
      `);
      console.log('   ✅ Índice idx_sellers_territorio_tipo criado\n');
    } catch (error: any) {
      console.log('   ⏭️  Índice idx_sellers_territorio_tipo já existe ou erro (ignorando)\n');
    }

    console.log('✅ Migração concluída com sucesso!\n');
    return true;

  } catch (error: any) {
    console.error('❌ Erro ao executar migração:', error.message);
    return false;
  }
}

async function populateTerritories() {
  console.log('🗺️  Populando territórios dos executivos...\n');

  try {
    // Buscar todos os executivos
    const sellers = await prisma.seller.findMany({
      select: {
        id: true,
        name: true
      }
    });

    console.log(`📋 Encontrados ${sellers.length} executivos\n`);

    // Configurações pré-definidas
    const configs = [
      {
        namePattern: ['Celio', 'CELIO'],
        territorio: {
          territorioTipo: 'raio',
          baseCidade: 'Sorocaba, SP',
          baseLatitude: -23.5015,
          baseLongitude: -47.4526,
          raioKm: 100,
          territorioAtivo: true
        }
      },
      {
        namePattern: ['Cicero', 'CICERO', 'Cícero'],
        territorio: {
          territorioTipo: 'raio',
          baseCidade: 'Santo André, SP',
          baseLatitude: -23.6536,
          baseLongitude: -46.5286,
          raioKm: 15,
          territorioAtivo: true
        }
      },
      {
        namePattern: ['Glauber', 'GLAUBER'],
        territorio: {
          territorioTipo: 'raio',
          baseCidade: 'Campinas, SP',
          baseLatitude: -22.9099,
          baseLongitude: -47.0626,
          raioKm: 70,
          territorioAtivo: true
        }
      },
      {
        namePattern: ['Reginaldo', 'REGINALDO'],
        territorio: {
          territorioTipo: 'raio',
          baseCidade: 'São Paulo - Zona Leste (Tatuapé), SP',
          baseLatitude: -23.5400,
          baseLongitude: -46.5757,
          raioKm: 140,
          territorioAtivo: true
        }
      },
      {
        namePattern: ['João', 'JOAO', 'Santana'],
        territorio: {
          territorioTipo: 'raio',
          baseCidade: 'São Paulo - Centro (Av. Paulista), SP',
          baseLatitude: -23.5617,
          baseLongitude: -46.6561,
          raioKm: 35,
          territorioAtivo: true
        }
      }
    ];

    let updated = 0;

    for (const seller of sellers) {
      for (const config of configs) {
        const matches = config.namePattern.some(pattern => 
          seller.name.includes(pattern) || seller.name.toLowerCase().includes(pattern.toLowerCase())
        );

        if (matches) {
          console.log(`✅ Configurando: ${seller.name}`);
          console.log(`   Tipo: ${config.territorio.territorioTipo}`);
          console.log(`   Base: ${config.territorio.baseCidade}`);
          console.log(`   Raio: ${config.territorio.raioKm}km\n`);

          await prisma.seller.update({
            where: { id: seller.id },
            data: config.territorio
          });

          updated++;
          break;
        }
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   ✅ Executivos configurados: ${updated}`);
    console.log(`   ⏭️  Executivos sem configuração: ${sellers.length - updated}`);

    return true;

  } catch (error: any) {
    console.error('❌ Erro ao popular territórios:', error.message);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('🚀 SETUP DO SISTEMA DE ATRIBUIÇÃO GEOGRÁFICA');
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. Executar migração
    const migrationSuccess = await executeMigration();
    
    if (!migrationSuccess) {
      console.log('\n⚠️  Migração falhou. Verifique os erros acima.\n');
      return;
    }

    // 2. Popular territórios
    const populateSuccess = await populateTerritories();

    if (populateSuccess) {
      console.log('\n═══════════════════════════════════════');
      console.log('✅ SETUP CONCLUÍDO COM SUCESSO!');
      console.log('═══════════════════════════════════════\n');
    } else {
      console.log('\n⚠️  Setup concluído com alguns avisos.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Erro durante o setup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

