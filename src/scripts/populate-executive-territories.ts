/**
 * Script para popular territórios geográficos dos executivos
 * Executa as configurações pré-definidas conforme especificação
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateExecutiveTerritories() {
  console.log('🗺️  Iniciando população de territórios geográficos...\n');

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
          break; // Só atualizar uma vez por executivo
        }
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   ✅ Executivos configurados: ${updated}`);
    console.log(`   ⏭️  Executivos sem configuração: ${sellers.length - updated}`);

    // Listar executivos sem configuração
    const sellersWithoutConfig = await prisma.seller.findMany({
      where: {
        OR: [
          { territorioTipo: null },
          { territorioTipo: 'cep_legado' },
          { territorioAtivo: false }
        ]
      },
      select: {
        name: true,
        territorioTipo: true
      }
    });

    if (sellersWithoutConfig.length > 0) {
      console.log(`\n⚠️  Executivos sem território geográfico configurado:`);
      sellersWithoutConfig.forEach(s => {
        console.log(`   - ${s.name} (${s.territorioTipo || 'não configurado'})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Erro ao popular territórios:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
populateExecutiveTerritories()
  .then(() => {
    console.log('\n✅ Script concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro ao executar script:', error);
    process.exit(1);
  });

