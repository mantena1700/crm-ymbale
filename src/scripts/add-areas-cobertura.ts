import { prisma } from '../lib/db';

async function addAreasCobertura() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sellers 
      ADD COLUMN IF NOT EXISTS areas_cobertura JSONB NULL
    `);
    console.log('✅ Campo areas_cobertura adicionado com sucesso!');
  } catch (error: any) {
    console.error('❌ Erro ao adicionar campo:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addAreasCobertura();

