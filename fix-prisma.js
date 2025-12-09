// Script para regenerar Prisma Client
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Regenerando Prisma Client...\n');

try {
    // 1. Limpar cache
    console.log('1. Limpando cache...');
    const prismaPath = path.join(__dirname, 'node_modules', '.prisma');
    if (fs.existsSync(prismaPath)) {
        fs.rmSync(prismaPath, { recursive: true, force: true });
    }
    const nextPath = path.join(__dirname, '.next');
    if (fs.existsSync(nextPath)) {
        fs.rmSync(nextPath, { recursive: true, force: true });
    }
    console.log('   ✅ Cache limpo\n');

    // 2. Validar schema
    console.log('2. Validando schema...');
    execSync('npx prisma validate', { stdio: 'inherit', cwd: __dirname });
    console.log('   ✅ Schema válido\n');

    // 3. Sincronizar banco
    console.log('3. Sincronizando banco de dados...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: __dirname });
    console.log('   ✅ Banco sincronizado\n');

    // 4. Gerar Prisma Client
    console.log('4. Gerando Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: __dirname });
    console.log('   ✅ Prisma Client gerado\n');

    // 5. Verificar se zonaCep está disponível
    console.log('5. Verificando modelo zonaCep...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    if (typeof prisma.zonaCep !== 'undefined') {
        console.log('   ✅ Modelo zonaCep disponível!\n');
        console.log('✅ Tudo pronto! Reinicie o servidor Next.js agora.\n');
    } else {
        console.log('   ⚠️  Modelo zonaCep ainda não disponível');
        console.log('   Tente reiniciar o servidor Next.js mesmo assim.\n');
    }
    
    prisma.$disconnect();
    
} catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
}
