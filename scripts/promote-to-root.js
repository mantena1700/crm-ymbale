
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const identifier = process.argv[2];

    if (!identifier) {
        console.error('Please provide an email address or username.');
        console.log('Usage: node promote-to-root.js <email_or_username>');
        process.exit(1);
    }

    console.log(`Searching for user with identifier: "${identifier}"...`);

    try {
        // Try to find by email OR username
        // Note: Prisma's findUnique only works for unique fields one at a time, or compound IDs.
        // findFirst allows OR query.
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { equals: identifier, mode: 'insensitive' } },
                    { username: { equals: identifier, mode: 'insensitive' } }
                ]
            },
        });

        if (!user) {
            console.error('❌ User not found!');
            console.log('Use "node list-users.js" to look up available users.');
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (@${user.username}) - Current Role: ${user.role}`);

        await prisma.user.update({
            where: { id: user.id },
            data: { role: 'root' },
        });

        console.log(`✅ SUCCESS: User ${user.name} (@${user.username}) is now ROOT.`);
    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
