import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupCoordinates() {
  console.log('\n🔧 CONFIGURANDO COORDENADAS...\n');

  try {
    // 1. Adicionar colunas na tabela restaurants
    console.log('📝 Adicionando colunas latitude e longitude na tabela restaurants...');
    await prisma.$executeRaw`
      ALTER TABLE restaurants 
      ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
    `;
    console.log('✅ Colunas adicionadas em restaurants\n');

    // 2. Adicionar colunas na tabela fixed_clients
    console.log('📝 Adicionando colunas latitude e longitude na tabela fixed_clients...');
    await prisma.$executeRaw`
      ALTER TABLE fixed_clients 
      ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
    `;
    console.log('✅ Colunas adicionadas em fixed_clients\n');

    // 3. Criar índices
    console.log('📝 Criando índices para melhorar performance...');
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_restaurants_coordinates 
      ON restaurants(latitude, longitude) 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_fixed_clients_coordinates 
      ON fixed_clients(latitude, longitude) 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `;
    console.log('✅ Índices criados\n');

    console.log('🎉 Configuração das colunas concluída!\n');
    console.log('📊 Agora execute: npm run populate-coords\n');
    
  } catch (error: any) {
    console.error('❌ Erro ao configurar coordenadas:', error.message);
    throw error;
  }
}

setupCoordinates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

