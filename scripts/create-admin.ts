/**
 * Script para criar o usuário administrador padrão
 * Execute: npx dotenv-cli -e .env.local -- npx tsx scripts/create-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
    console.log('🔐 Verificando usuário administrador...\n');

    try {
        // Verificar se já existe um admin
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'admin' }
        });

        if (existingAdmin) {
            console.log('✅ Já existe um administrador:');
            console.log(`   Username: ${existingAdmin.username}`);
            console.log(`   Nome: ${existingAdmin.name}`);
            console.log('\n💡 Se esqueceu a senha, use o sistema para redefinir.');
            return;
        }

        // Criar admin
        const hashedPassword = await bcrypt.hash('admin', 12);

        const admin = await prisma.user.create({
            data: {
                username: 'admin',
                name: 'Administrador',
                email: 'admin@ymbale.com.br',
                password: hashedPassword,
                role: 'admin',
                active: true
            }
        });

        console.log('✅ Usuário administrador criado com sucesso!\n');
        console.log('📋 Credenciais:');
        console.log('   ┌─────────────────────────────────┐');
        console.log('   │  Usuário: admin                 │');
        console.log('   │  Senha:   admin                 │');
        console.log('   └─────────────────────────────────┘');
        console.log('\n⚠️  IMPORTANTE: Troque a senha no primeiro acesso!');
        console.log('   Acesse: Configurações > Usuários\n');

    } catch (error: any) {
        if (error.code === 'P2002') {
            console.log('ℹ️  Usuário "admin" já existe no sistema.');
        } else {
            console.error('❌ Erro ao criar admin:', error.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();

