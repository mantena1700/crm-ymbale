
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('Please provide an email address.');
        console.log('Usage: node promote-to-root.js <email>');
        process.exit(1);
    }

    console.log(`Promoting user ${email} to ROOT...`);

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            console.error('User not found!');
            process.exit(1);
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { role: 'root' },
        });

        console.log(`✅ User ${user.name} (${user.email}) is now ROOT.`);
    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
