
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                role: true,
                active: true
            },
            orderBy: { name: 'asc' }
        });

        console.log('\n📦 LISTA DE USUÁRIOS DO SISTEMA:');
        console.log('================================================================================');
        console.log('| Nome                 | Username      | Email                          | Role          |');
        console.log('|----------------------|---------------|--------------------------------|---------------|');

        users.forEach(user => {
            const name = (user.name || '').padEnd(20).slice(0, 20);
            const username = (user.username || '').padEnd(13).slice(0, 13);
            const email = (user.email || '').padEnd(30).slice(0, 30);
            const role = (user.role || '').padEnd(13).slice(0, 13);

            console.log(`| ${name} | ${username} | ${email} | ${role} |`);
        });
        console.log('================================================================================');
        console.log(`Total: ${users.length} usuários found.\n`);

    } catch (error) {
        console.error('Erro ao listar usuários:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
