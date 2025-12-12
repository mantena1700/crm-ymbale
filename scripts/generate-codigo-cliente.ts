/**
 * Script para gerar códigos de cliente para todos os restaurantes que não têm código
 * Execute: npx tsx scripts/generate-codigo-cliente.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateCodigoCliente() {
    console.log('🚀 Iniciando geração de códigos de cliente...\n');

    try {
        // Buscar todos os restaurantes sem código, ordenados por data de criação
        const restaurantsWithoutCode = await prisma.restaurant.findMany({
            where: {
                codigoCliente: null
            },
            orderBy: {
                createdAt: 'asc'
            },
            select: {
                id: true,
                name: true
            }
        });

        console.log(`📊 Encontrados ${restaurantsWithoutCode.length} restaurantes sem código\n`);

        if (restaurantsWithoutCode.length === 0) {
            console.log('✅ Todos os restaurantes já possuem código!');
            return;
        }

        // Buscar o maior código existente
        const maxCodigo = await prisma.restaurant.findFirst({
            where: {
                codigoCliente: {
                    not: null
                }
            },
            orderBy: {
                codigoCliente: 'desc'
            },
            select: {
                codigoCliente: true
            }
        });

        // Começar do maior código + 1, ou 10000 se não houver códigos
        let currentCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : 10000;

        console.log(`🔢 Iniciando códigos a partir de: ${currentCode}\n`);

        let updated = 0;
        let errors = 0;

        // Atribuir códigos sequencialmente
        for (const restaurant of restaurantsWithoutCode) {
            try {
                // Verificar se o código já existe (por segurança)
                while (await prisma.restaurant.findFirst({
                    where: { codigoCliente: currentCode }
                })) {
                    currentCode++;
                }

                await prisma.restaurant.update({
                    where: { id: restaurant.id },
                    data: { codigoCliente: currentCode }
                });

                updated++;
                if (updated % 100 === 0) {
                    console.log(`   ✅ ${updated} restaurantes atualizados...`);
                }

                currentCode++;
            } catch (error: any) {
                errors++;
                console.error(`   ❌ Erro ao atualizar ${restaurant.name}:`, error.message);
            }
        }

        console.log(`\n✅ Concluído!`);
        console.log(`   📝 ${updated} restaurantes atualizados`);
        if (errors > 0) {
            console.log(`   ⚠️  ${errors} erros encontrados`);
        }
        console.log(`   🔢 Próximo código disponível: ${currentCode}`);

    } catch (error: any) {
        console.error('❌ Erro ao gerar códigos:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

generateCodigoCliente()
    .then(() => {
        console.log('\n🎉 Processo finalizado!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erro fatal:', error);
        process.exit(1);
    });

