
import { prisma } from '../lib/db';
import { initializePermissions } from '../lib/permissions';

async function main() {
    console.log('🔄 Sincronizando permissões do sistema...');
    await initializePermissions();
    console.log('✅ Permissões sincronizadas com sucesso!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
