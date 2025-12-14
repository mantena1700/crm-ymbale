import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugCoordinates() {
  console.log('\n🔍 VERIFICANDO COORDENADAS\n');
  
  // Verificar se as colunas existem
  try {
    const columnsCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'restaurants' 
      AND column_name IN ('latitude', 'longitude')
    `;
    
    if (columnsCheck.length === 0) {
      console.log('❌ Colunas latitude e longitude NÃO EXISTEM na tabela restaurants');
      console.log('   Execute o SQL: scripts/add-coordinates-columns.sql');
    } else {
      console.log('✅ Colunas latitude e longitude EXISTEM na tabela restaurants');
    }
  } catch (error: any) {
    console.log('⚠️ Erro ao verificar colunas:', error.message);
  }

  // Verificar restaurantes usando query raw
  try {
    const restaurants = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      address: any;
      latitude: number | null;
      longitude: number | null;
      seller_id: string | null;
    }>>`
      SELECT 
        id, 
        name, 
        address,
        latitude,
        longitude,
        seller_id
      FROM restaurants
      LIMIT 10
    `;

    console.log('\n📍 RESTAURANTES (primeiros 10):');
    restaurants.forEach(r => {
      console.log(`\n${r.name}`);
      console.log(`  Endereço: ${JSON.stringify(r.address)}`);
      console.log(`  Coordenadas: ${r.latitude ? `${r.latitude}, ${r.longitude}` : '❌ SEM COORDENADAS'}`);
    });
  } catch (error: any) {
    console.log('\n⚠️ Erro ao buscar restaurantes:', error.message);
  }

  // Verificar clientes fixos usando query raw
  try {
    const fixedClients = await prisma.$queryRaw<Array<{
      id: string;
      client_name: string | null;
      client_address: any;
      latitude: number | null;
      longitude: number | null;
      radius_km: any;
      seller_id: string;
    }>>`
      SELECT 
        id,
        client_name,
        client_address,
        latitude,
        longitude,
        radius_km,
        seller_id
      FROM fixed_clients
    `;

    console.log('\n\n📍 CLIENTES FIXOS:');
    if (fixedClients.length === 0) {
      console.log('  Nenhum cliente fixo cadastrado');
    } else {
      fixedClients.forEach(c => {
        console.log(`\n${c.client_name || 'Sem nome'}`);
        console.log(`  Endereço: ${JSON.stringify(c.client_address)}`);
        console.log(`  Coordenadas: ${c.latitude ? `${c.latitude}, ${c.longitude}` : '❌ SEM COORDENADAS'}`);
        console.log(`  Raio de busca: ${c.radius_km}km`);
      });
    }
  } catch (error: any) {
    console.log('\n⚠️ Erro ao buscar clientes fixos:', error.message);
  }

  // Contar quantos têm coordenadas
  try {
    const restaurantsWithCoords = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM restaurants
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `;

    const restaurantsTotal = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM restaurants
    `;

    const fixedClientsWithCoords = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM fixed_clients
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `;

    const fixedClientsTotal = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM fixed_clients
    `;

    console.log('\n\n📊 RESUMO:');
    console.log(`Restaurantes com coordenadas: ${restaurantsWithCoords[0]?.count || 0}/${restaurantsTotal[0]?.count || 0}`);
    console.log(`Clientes fixos com coordenadas: ${fixedClientsWithCoords[0]?.count || 0}/${fixedClientsTotal[0]?.count || 0}`);
  } catch (error: any) {
    console.log('\n⚠️ Erro ao contar coordenadas:', error.message);
  }
}

debugCoordinates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
