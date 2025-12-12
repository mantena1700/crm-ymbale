const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runSQL() {
    try {
        console.log('📄 Lendo arquivo SQL...');
        const sqlFile = path.join(__dirname, 'create-fixed-clients-table.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // Remover comentários e dividir em comandos
        const commands = sql
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
        
        console.log(`📝 Executando ${commands.length} comandos SQL...`);
        
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i] + ';';
            if (command.trim() === ';') continue;
            
            try {
                console.log(`\n[${i + 1}/${commands.length}] Executando comando...`);
                await prisma.$executeRawUnsafe(command);
                console.log('✅ Comando executado com sucesso');
            } catch (error) {
                // Ignorar erros de "já existe" ou "não existe"
                if (error.message.includes('already exists') || 
                    error.message.includes('does not exist') ||
                    error.message.includes('duplicate')) {
                    console.log('⚠️  Comando ignorado (já existe ou não necessário)');
                } else {
                    console.error(`❌ Erro ao executar comando:`, error.message);
                }
            }
        }
        
        console.log('\n✅ Script SQL executado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao executar script:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runSQL();

