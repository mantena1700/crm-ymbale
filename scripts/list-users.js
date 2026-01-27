
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Listing all users in the system...');
    console.log('-----------------------------------');

    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: true,
                active: true
            }
        });

        if (users.length === 0) {
            console.log('No users found.');
            return;
        }

        console.table(users.map(u => ({
            Username: u.username,
            Email: u.email || 'N/A',
            Role: u.role,
            Name: u.name,
            Active: u.active ? 'Yes' : 'No'
        })));

        console.log(`Total: ${users.length} users.`);

    } catch (error) {
        console.error('Error listing users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
