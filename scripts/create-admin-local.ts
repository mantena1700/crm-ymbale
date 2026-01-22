import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Criando usuário administrador...');

    // Verificar se já existe um usuário admin
    const existingAdmin = await prisma.user.findFirst({
        where: {
            username: 'admin'
        }
    });

    if (existingAdmin) {
        console.log('✅ Usuário admin já existe!');
        console.log('   Username: admin');
        return;
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash('admin', 10);

    // Criar usuário admin
    const admin = await prisma.user.create({
        data: {
            username: 'admin',
            password: hashedPassword,
            name: 'Administrador',
            email: 'admin@ymbale.com',
            role: 'ADMIN',
            active: true
        }
    });

    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('');
    console.log('📋 Credenciais de acesso:');
    console.log('   Username: admin');
    console.log('   Password: admin');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
}

main()
    .catch((e) => {
        console.error('❌ Erro ao criar usuário:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
