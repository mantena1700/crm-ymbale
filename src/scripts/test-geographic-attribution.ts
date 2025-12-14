/**
 * Script de teste do sistema de atribuição geográfica
 * Testa a atribuição automática com endereços conhecidos
 */

import { PrismaClient } from '@prisma/client';
import { atribuirExecutivoAutomatico } from '../lib/geographic-attribution';

const prisma = new PrismaClient();

async function testarSistemaAtribuicao() {
  const testes = [
    {
      nome: 'Pizzaria em Sorocaba',
      cep: '18030-310',
      endereco: {
        street: 'Rua Teste',
        city: 'Sorocaba',
        state: 'SP',
        zip: '18030-310'
      },
      esperado: 'Celio'
    },
    {
      nome: 'Restaurante em Santo André',
      cep: '09175-500',
      endereco: {
        street: 'Rua Teste',
        city: 'Santo André',
        state: 'SP',
        zip: '09175-500'
      },
      esperado: 'Cicero'
    },
    {
      nome: 'Lanchonete em Campinas',
      cep: '13024-000',
      endereco: {
        street: 'Rua Teste',
        city: 'Campinas',
        state: 'SP',
        zip: '13024-000'
      },
      esperado: 'Glauber'
    },
    {
      nome: 'Bar em Americana',
      cep: '13465-000',
      endereco: {
        street: 'Rua Teste',
        city: 'Americana',
        state: 'SP',
        zip: '13465-000'
      },
      esperado: 'Glauber'
    },
    {
      nome: 'Café em São José dos Campos',
      cep: '12200-000',
      endereco: {
        street: 'Rua Teste',
        city: 'São José dos Campos',
        state: 'SP',
        zip: '12200-000'
      },
      esperado: 'Reginaldo'
    },
    {
      nome: 'Padaria na Vila Mariana (SP)',
      cep: '04101-000',
      endereco: {
        street: 'Rua Teste',
        city: 'São Paulo',
        state: 'SP',
        zip: '04101-000'
      },
      esperado: 'João'
    }
  ];

  console.log('═══════════════════════════════════════');
  console.log('INICIANDO TESTES DE ATRIBUIÇÃO');
  console.log('═══════════════════════════════════════\n');

  let passou = 0;
  let falhou = 0;

  for (const teste of testes) {
    console.log(`\n🧪 Testando: ${teste.nome}`);
    console.log(`   CEP: ${teste.cep}`);
    console.log(`   Esperado: ${teste.esperado}`);

    try {
      const resultado = await atribuirExecutivoAutomatico({
        name: teste.nome,
        address: teste.endereco,
        cep: teste.cep
      });

      if (resultado.sucesso) {
        const passouTeste = resultado.executivo_nome?.includes(teste.esperado) || false;
        console.log(`   ✅ Resultado: ${resultado.executivo_nome}`);
        console.log(`   📏 Distância: ${resultado.distancia_km}km`);
        console.log(`   🔧 Método: ${resultado.metodo}`);
        console.log(`   🎯 Status: ${passouTeste ? 'PASSOU ✓' : 'FALHOU ✗'}`);
        
        if (passouTeste) {
          passou++;
        } else {
          falhou++;
        }
      } else {
        console.log(`   ❌ Erro: ${resultado.erro}`);
        falhou++;
      }
    } catch (error: any) {
      console.log(`   ❌ Exceção: ${error.message}`);
      falhou++;
    }

    // Delay entre testes para respeitar rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  console.log('\n═══════════════════════════════════════');
  console.log('RESULTADOS DOS TESTES');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Passou: ${passou}`);
  console.log(`❌ Falhou: ${falhou}`);
  console.log(`📊 Taxa de sucesso: ${((passou / testes.length) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════\n');
}

// Executar
testarSistemaAtribuicao()
  .then(async () => {
    await prisma.$disconnect();
    console.log('✅ Testes concluídos!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ Erro ao executar testes:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

