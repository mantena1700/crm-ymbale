/**
 * Script para re-atribuir restaurantes existentes usando Google Maps API
 * Remove atribuições antigas por zona e atribui usando o novo sistema geográfico
 */

import { PrismaClient } from '@prisma/client';
import { atribuirExecutivoAutomatico } from '../lib/geographic-attribution';

const prisma = new PrismaClient();

async function reatribuirRestaurantes() {
  console.log('═══════════════════════════════════════');
  console.log('🔄 RE-ATRIBUIÇÃO DE RESTAURANTES');
  console.log('═══════════════════════════════════════\n');

  try {
    // Buscar todos os restaurantes
    const restaurantes = await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        sellerId: true
      }
    });

    console.log(`📋 Total de restaurantes: ${restaurantes.length}\n`);

    let reatribuidos = 0;
    let mantidos = 0;
    let erros = 0;
    let semEndereco = 0;

    for (let i = 0; i < restaurantes.length; i++) {
      const restaurante = restaurantes[i];
      
      // Delay para não sobrecarregar a API (100ms entre requisições)
      if (i > 0 && i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        // Verificar se tem endereço
        if (!restaurante.address || typeof restaurante.address !== 'object') {
          semEndereco++;
          console.log(`   ⏭️  ${i + 1}/${restaurantes.length} - ${restaurante.name}: Sem endereço válido`);
          continue;
        }

        const address = restaurante.address as any;

        // Tentar atribuir usando o novo sistema
        const atribuicao = await atribuirExecutivoAutomatico({
          id: restaurante.id,
          name: restaurante.name,
          address: address,
          latitude: restaurante.latitude,
          longitude: restaurante.longitude
        });

        if (atribuicao.sucesso && atribuicao.executivo_id) {
          // Verificar se mudou de executivo
          if (restaurante.sellerId !== atribuicao.executivo_id) {
            // Atualizar executivo
            await prisma.restaurant.update({
              where: { id: restaurante.id },
              data: {
                sellerId: atribuicao.executivo_id,
                assignedAt: new Date()
              }
            });
            reatribuidos++;
            console.log(`   ✅ ${i + 1}/${restaurantes.length} - ${restaurante.name}`);
            console.log(`      Novo executivo: ${atribuicao.executivo_nome} (${atribuicao.distancia_km}km)`);
          } else {
            mantidos++;
            if ((i + 1) % 20 === 0) {
              console.log(`   ✓ ${i + 1}/${restaurantes.length} - Mantido: ${restaurante.name}`);
            }
          }
        } else {
          erros++;
          console.log(`   ❌ ${i + 1}/${restaurantes.length} - ${restaurante.name}: ${atribuicao.erro || 'Erro desconhecido'}`);
        }

      } catch (error: any) {
        erros++;
        console.log(`   ❌ ${i + 1}/${restaurantes.length} - ${restaurante.name}: ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESUMO DA RE-ATRIBUIÇÃO');
    console.log('═══════════════════════════════════════\n');
    console.log(`   ✅ Re-atribuídos: ${reatribuidos}`);
    console.log(`   ✓ Mantidos: ${mantidos}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   ⏭️  Sem endereço: ${semEndereco}`);
    console.log(`   📊 Total processado: ${restaurantes.length}\n`);

  } catch (error: any) {
    console.error('❌ Erro na re-atribuição:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

reatribuirRestaurantes()
  .then(() => {
    console.log('\n✅ Re-atribuição concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

