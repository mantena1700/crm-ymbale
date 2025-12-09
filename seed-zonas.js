// Script para popular zonas padrão
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedZonas() {
    try {
        console.log('🌱 Iniciando seed de zonas...\n');

        const zonasPadrao = [
            { zonaNome: 'SP Zona Norte', cepInicial: '02000000', cepFinal: '02999999' },
            { zonaNome: 'SP Zona Sul', cepInicial: '04000000', cepFinal: '04999999' },
            { zonaNome: 'SP Zona Leste', cepInicial: '03000000', cepFinal: '03999999' },
            { zonaNome: 'SP Zona Oeste', cepInicial: '05000000', cepFinal: '05999999' },
            { zonaNome: 'SP Centro', cepInicial: '01000000', cepFinal: '01599999' },
            { zonaNome: 'Guarulhos Centro', cepInicial: '07000000', cepFinal: '07299999' },
            { zonaNome: 'Guarulhos Zona Norte', cepInicial: '07400000', cepFinal: '07499999' },
            { zonaNome: 'Osasco', cepInicial: '06000000', cepFinal: '06299999' },
            { zonaNome: 'Santo André', cepInicial: '09000000', cepFinal: '09299999' },
            { zonaNome: 'São Bernardo do Campo', cepInicial: '09700000', cepFinal: '09899999' },
            { zonaNome: 'São Caetano do Sul', cepInicial: '09500000', cepFinal: '09599999' },
            { zonaNome: 'Diadema', cepInicial: '09900000', cepFinal: '09999999' },
            { zonaNome: 'Mauá', cepInicial: '09300000', cepFinal: '09399999' },
            { zonaNome: 'Sorocaba Centro', cepInicial: '18000000', cepFinal: '18109999' },
            { zonaNome: 'Sorocaba Norte', cepInicial: '18110000', cepFinal: '18199999' },
            { zonaNome: 'Campinas Centro', cepInicial: '13000000', cepFinal: '13099999' },
            { zonaNome: 'Campinas Zona Norte', cepInicial: '13070000', cepFinal: '13099999' },
            { zonaNome: 'Jundiaí', cepInicial: '13200000', cepFinal: '13219999' },
            { zonaNome: 'Barueri/Alphaville', cepInicial: '06400000', cepFinal: '06499999' },
            { zonaNome: 'Taboão da Serra', cepInicial: '06760000', cepFinal: '06769999' },
        ];

        let created = 0;
        let skipped = 0;
        let errors = 0;

        // Garantir que a tabela existe
        try {
            await prisma.$queryRaw`SELECT 1 FROM zonas_cep LIMIT 1`;
        } catch (error) {
            console.log('📋 Criando tabela zonas_cep...');
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS zonas_cep (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    zona_nome VARCHAR(100) NOT NULL,
                    cep_inicial VARCHAR(9) NOT NULL,
                    cep_final VARCHAR(9) NOT NULL,
                    ativo BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
                    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
                )
            `;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_zonas_cep_ativo ON zonas_cep(ativo)`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_zonas_cep_range ON zonas_cep(cep_inicial, cep_final)`;
            console.log('✅ Tabela criada!\n');
        }

        for (const zona of zonasPadrao) {
            try {
                // Verificar se já existe
                const existing = await prisma.$queryRaw`
                    SELECT id FROM zonas_cep WHERE zona_nome = ${zona.zonaNome} LIMIT 1
                `;

                if (Array.isArray(existing) && existing.length > 0) {
                    console.log(`⏭️  ${zona.zonaNome} - já existe, pulando`);
                    skipped++;
                    continue;
                }

                // Criar a zona
                await prisma.$executeRaw`
                    INSERT INTO zonas_cep (id, zona_nome, cep_inicial, cep_final, ativo, created_at, updated_at)
                    VALUES (gen_random_uuid(), ${zona.zonaNome}, ${zona.cepInicial}, ${zona.cepFinal}, true, NOW(), NOW())
                `;
                console.log(`✅ ${zona.zonaNome} - criada`);
                created++;
            } catch (error) {
                console.error(`❌ ${zona.zonaNome} - erro:`, error.message);
                errors++;
            }
        }

        console.log(`\n📊 Resumo:`);
        console.log(`   ✅ Criadas: ${created}`);
        console.log(`   ⏭️  Puladas: ${skipped}`);
        console.log(`   ❌ Erros: ${errors}`);
        console.log(`\n🎉 Seed concluído!\n`);

    } catch (error) {
        console.error('❌ Erro no seed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedZonas();
