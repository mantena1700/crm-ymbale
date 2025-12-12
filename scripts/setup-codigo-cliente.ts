/**
 * Script para configurar o campo codigo_cliente no banco de dados
 * Execute: npx tsx scripts/setup-codigo-cliente.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupCodigoCliente() {
    console.log('🚀 Iniciando configuração do campo codigo_cliente...\n');

    try {
        // 1. Verificar se o campo já existe
        console.log('📋 Verificando se o campo codigo_cliente existe...');
        try {
            await prisma.$queryRaw`SELECT codigo_cliente FROM restaurants LIMIT 1`;
            console.log('✅ Campo codigo_cliente já existe no banco!\n');
        } catch (error: any) {
            if (error.message?.includes('codigo_cliente') || 
                error.message?.includes('does not exist') || 
                error.message?.includes('Unknown column')) {
                console.log('⚠️ Campo não existe. Criando...\n');
                
                // 2. Adicionar coluna
                console.log('📝 Adicionando coluna codigo_cliente...');
                await prisma.$executeRaw`
                    ALTER TABLE restaurants 
                    ADD COLUMN IF NOT EXISTS codigo_cliente INTEGER UNIQUE
                `;
                console.log('✅ Coluna adicionada!\n');
                
                // 3. Criar índice
                console.log('📝 Criando índice...');
                await prisma.$executeRaw`
                    CREATE INDEX IF NOT EXISTS idx_restaurants_codigo_cliente 
                    ON restaurants(codigo_cliente)
                `;
                console.log('✅ Índice criado!\n');
            } else {
                throw error;
            }
        }

        // 4. Verificar quantos restaurantes não têm código
        console.log('📊 Verificando restaurantes sem código...');
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::int as count
            FROM restaurants
            WHERE codigo_cliente IS NULL
        `;
        
        const restaurantsWithoutCode = Number(result[0]?.count || 0);
        console.log(`   Encontrados ${restaurantsWithoutCode} restaurantes sem código\n`);

        if (restaurantsWithoutCode > 0) {
            // 5. Buscar o maior código existente
            console.log('📝 Buscando maior código existente...');
            const maxCodigoResult = await prisma.$queryRaw<Array<{ codigo_cliente: number | null }>>`
                SELECT codigo_cliente
                FROM restaurants
                WHERE codigo_cliente IS NOT NULL
                ORDER BY codigo_cliente DESC
                LIMIT 1
            `;
            
            let currentCode = maxCodigoResult[0]?.codigo_cliente ? maxCodigoResult[0].codigo_cliente + 1 : 10000;
            console.log(`   Próximo código: ${currentCode}\n`);

            // 6. Gerar códigos para todos os restaurantes sem código
            console.log('📝 Gerando códigos para restaurantes sem código...');
            const restaurantsToUpdate = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
                SELECT id, name
                FROM restaurants
                WHERE codigo_cliente IS NULL
                ORDER BY created_at ASC
            `;

            let generated = 0;
            for (const restaurant of restaurantsToUpdate) {
                // Verificar se o código já existe
                const existing = await prisma.$queryRaw<Array<{ id: string }>>`
                    SELECT id FROM restaurants WHERE codigo_cliente = ${currentCode} LIMIT 1
                `;
                
                while (existing.length > 0) {
                    currentCode++;
                    const checkAgain = await prisma.$queryRaw<Array<{ id: string }>>`
                        SELECT id FROM restaurants WHERE codigo_cliente = ${currentCode} LIMIT 1
                    `;
                    if (checkAgain.length === 0) break;
                }
                
                await prisma.$executeRaw`
                    UPDATE restaurants
                    SET codigo_cliente = ${currentCode}
                    WHERE id = ${restaurant.id}::uuid
                `;
                
                generated++;
                if (generated % 100 === 0) {
                    console.log(`   ✅ ${generated} códigos gerados...`);
                }
                
                currentCode++;
            }
            
            console.log(`\n✅ Total de ${generated} códigos gerados!`);
        } else {
            console.log('✅ Todos os restaurantes já possuem código!');
        }

        // 7. Verificar status final
        console.log('\n📊 Status final:');
        const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::int as count FROM restaurants
        `;
        const withCodeResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::int as count 
            FROM restaurants 
            WHERE codigo_cliente IS NOT NULL
        `;
        const nextCodeResult = await prisma.$queryRaw<Array<{ codigo_cliente: number | null }>>`
            SELECT codigo_cliente
            FROM restaurants
            WHERE codigo_cliente IS NOT NULL
            ORDER BY codigo_cliente DESC
            LIMIT 1
        `;
        
        const total = Number(totalResult[0]?.count || 0);
        const withCode = Number(withCodeResult[0]?.count || 0);
        const nextCode = nextCodeResult[0]?.codigo_cliente ? nextCodeResult[0].codigo_cliente + 1 : 10000;
        
        console.log(`   Total de restaurantes: ${total}`);
        console.log(`   Com código: ${withCode}`);
        console.log(`   Sem código: ${total - withCode}`);
        console.log(`   Próximo código disponível: ${nextCode}`);

        console.log('\n✅ Configuração concluída com sucesso!');

    } catch (error: any) {
        console.error('\n❌ Erro ao configurar codigo_cliente:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

setupCodigoCliente()
    .then(() => {
        console.log('\n🎉 Processo finalizado!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erro fatal:', error);
        process.exit(1);
    });

