/**
 * Script para executar migração e popular territórios
 * Executa a migração SQL e depois popula os territórios dos executivos
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('📦 Executando migração do banco de dados...\n');

  try {
    // Ler arquivo SQL
    const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', 'add-geographic-territory.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ Arquivo SQL não encontrado: ${sqlPath}`);
      return false;
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Dividir em comandos individuais (remover comentários e linhas vazias)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('/*'));

    console.log(`📝 Executando ${commands.length} comandos SQL...\n`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Pular comandos que são apenas comentários ou vazios
      if (command.length < 10) continue;
      
      try {
        // Executar comando SQL
        await prisma.$executeRawUnsafe(command);
        console.log(`   ✅ Comando ${i + 1}/${commands.length} executado`);
      } catch (error: any) {
        // Ignorar erros de "já existe" (IF NOT EXISTS)
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            error.message?.includes('does not exist')) {
          console.log(`   ⏭️  Comando ${i + 1}/${commands.length} ignorado (já existe ou não necessário)`);
        } else {
          console.warn(`   ⚠️  Erro no comando ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Migração concluída!\n');
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

    return true;

  } catch (error: any) {
    console.error('❌ Erro ao popular territórios:', error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('🚀 SETUP DO SISTEMA DE ATRIBUIÇÃO GEOGRÁFICA');
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. Executar migração
    const migrationSuccess = await runMigration();
    
    if (!migrationSuccess) {
      console.log('\n⚠️  Migração teve problemas, mas continuando...\n');
    }

    // 2. Popular territórios
    const populateSuccess = await populateTerritories();

    if (migrationSuccess && populateSuccess) {
      console.log('\n═══════════════════════════════════════');
      console.log('✅ SETUP CONCLUÍDO COM SUCESSO!');
      console.log('═══════════════════════════════════════\n');
      console.log('📝 Próximos passos:');
      console.log('   1. Reiniciar o servidor: npm run dev');
      console.log('   2. Testar atribuição: npm run test-attribution');
      console.log('   3. Verificar no banco se as colunas foram criadas\n');
    } else {
      console.log('\n⚠️  Setup concluído com alguns avisos. Verifique os logs acima.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Erro durante o setup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

