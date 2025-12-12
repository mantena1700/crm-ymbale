import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function ensureFixedClientsTable() {
    try {
        console.log('🔍 Verificando se a tabela fixed_clients existe...');
        
        // Verificar se a tabela existe
        const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'fixed_clients'
            ) as exists
        `;
        
        if (tableExists[0]?.exists) {
            console.log('✅ Tabela fixed_clients já existe!');
            return;
        }
        
        console.log('📄 Tabela não encontrada. Criando...');
        
        // Ler e executar o SQL
        const sqlFile = path.join(__dirname, 'create-fixed-clients-table.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // Dividir em comandos e executar
        const commands = sql
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
        
        for (const command of commands) {
            if (command.trim() === '') continue;
            try {
                await prisma.$executeRawUnsafe(command + ';');
            } catch (error: any) {
                // Ignorar erros de "já existe"
                if (!error.message.includes('already exists') && 
                    !error.message.includes('duplicate')) {
                    console.error('Erro ao executar comando:', error.message);
                }
            }
        }
        
        console.log('✅ Tabela fixed_clients criada com sucesso!');
        
    } catch (error: any) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

ensureFixedClientsTable();

