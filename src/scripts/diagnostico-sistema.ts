/**
 * Script de diagnóstico do sistema de atribuição geográfica
 * Verifica se tudo está configurado corretamente
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnostico() {
  console.log('═══════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DO SISTEMA');
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. Verificar executivos
    console.log('1️⃣ VERIFICANDO EXECUTIVOS...\n');
    const executivos = await prisma.seller.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        territorioTipo: true,
        baseCidade: true,
        baseLatitude: true,
        baseLongitude: true,
        raioKm: true,
        territorioAtivo: true
      }
    });

    console.log(`   Total de executivos: ${executivos.length}\n`);

    const executivosConfigurados = executivos.filter(e => 
      e.territorioAtivo && 
      e.territorioTipo === 'raio' && 
      e.baseLatitude && 
      e.baseLongitude && 
      e.raioKm
    );

    console.log(`   ✅ Executivos configurados geograficamente: ${executivosConfigurados.length}`);
    console.log(`   ⚠️  Executivos sem configuração: ${executivos.length - executivosConfigurados.length}\n`);

    if (executivosConfigurados.length > 0) {
      console.log('   Executivos configurados:');
      executivosConfigurados.forEach(e => {
        console.log(`   - ${e.name}`);
        console.log(`     Base: ${e.baseCidade || 'N/A'}`);
        console.log(`     Coordenadas: ${e.baseLatitude}, ${e.baseLongitude}`);
        console.log(`     Raio: ${e.raioKm}km`);
        console.log(`     Ativo: ${e.active ? 'Sim' : 'Não'}\n`);
      });
    } else {
      console.log('   ⚠️  NENHUM EXECUTIVO CONFIGURADO!\n');
      console.log('   Execute: npm run setup-geographic\n');
    }

    // 2. Verificar restaurantes
    console.log('2️⃣ VERIFICANDO RESTAURANTES...\n');
    const totalRestaurantes = await prisma.restaurant.count();
    const restaurantesComCoords = await prisma.restaurant.count({
      where: {
        latitude: { not: null },
        longitude: { not: null }
      }
    });
    const restaurantesComExecutivo = await prisma.restaurant.count({
      where: {
        sellerId: { not: null }
      }
    });

    console.log(`   Total de restaurantes: ${totalRestaurantes}`);
    console.log(`   Com coordenadas: ${restaurantesComCoords}`);
    console.log(`   Com executivo atribuído: ${restaurantesComExecutivo}\n`);

    // 3. Verificar distribuição por executivo
    console.log('3️⃣ DISTRIBUIÇÃO POR EXECUTIVO...\n');
    const distribuicao = await prisma.restaurant.groupBy({
      by: ['sellerId'],
      _count: {
        id: true
      },
      where: {
        sellerId: { not: null }
      }
    });

    if (distribuicao.length > 0) {
      for (const item of distribuicao) {
        const seller = await prisma.seller.findUnique({
          where: { id: item.sellerId! },
          select: { name: true }
        });
        console.log(`   ${seller?.name || 'Desconhecido'}: ${item._count.id} restaurantes`);
      }
    } else {
      console.log('   ⚠️  Nenhum restaurante atribuído ainda\n');
    }

    // 4. Verificar API Key do Google Maps
    console.log('\n4️⃣ VERIFICANDO CONFIGURAÇÃO...\n');
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      console.log(`   ✅ Google Maps API Key configurada: ${apiKey.substring(0, 20)}...`);
    } else {
      console.log('   ⚠️  Google Maps API Key NÃO configurada!');
      console.log('   Adicione GOOGLE_MAPS_API_KEY no arquivo .env\n');
    }

    // 5. Resumo e recomendações
    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESUMO');
    console.log('═══════════════════════════════════════\n');

    const problemas: string[] = [];

    if (executivosConfigurados.length === 0) {
      problemas.push('❌ Nenhum executivo configurado geograficamente');
    }

    if (totalRestaurantes === 0) {
      problemas.push('⚠️  Nenhum restaurante no banco de dados');
    } else if (restaurantesComExecutivo === 0) {
      problemas.push('⚠️  Nenhum restaurante atribuído a executivos');
    }

    if (!apiKey) {
      problemas.push('❌ Google Maps API Key não configurada');
    }

    if (problemas.length === 0) {
      console.log('✅ Sistema configurado corretamente!\n');
      console.log('📝 Próximos passos:');
      console.log('   1. Importe uma planilha de restaurantes');
      console.log('   2. Os restaurantes serão atribuídos automaticamente');
      console.log('   3. Verifique no dashboard se aparecem atribuídos\n');
    } else {
      console.log('⚠️  Problemas encontrados:\n');
      problemas.forEach(p => console.log(`   ${p}\n`));
      
      console.log('🔧 Ações recomendadas:\n');
      if (executivosConfigurados.length === 0) {
        console.log('   1. Execute: npm run setup-geographic\n');
      }
      if (!apiKey) {
        console.log('   2. Configure GOOGLE_MAPS_API_KEY no .env\n');
      }
      if (totalRestaurantes === 0) {
        console.log('   3. Importe uma planilha de restaurantes\n');
      }
    }

  } catch (error: any) {
    console.error('❌ Erro no diagnóstico:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnostico()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });

