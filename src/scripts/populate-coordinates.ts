import { PrismaClient } from '@prisma/client';
import { getCoordinatesFromAddress } from '../lib/distance-calculator';

const prisma = new PrismaClient();

async function populateCoordinates() {
  console.log('🔄 Iniciando população de coordenadas...\n');

  // Atualizar restaurantes
  const restaurants = await prisma.restaurant.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });

  console.log(`📍 Encontrados ${restaurants.length} restaurantes sem coordenadas`);

  let restaurantsUpdated = 0;
  for (const restaurant of restaurants) {
    const coords = getCoordinatesFromAddress(restaurant.address);
    
    if (coords) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          latitude: coords.latitude,
          longitude: coords.longitude
        }
      });
      restaurantsUpdated++;
      console.log(`✅ ${restaurant.name}: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } else {
      console.log(`⚠️  ${restaurant.name}: sem coordenadas válidas`);
    }
  }

  console.log(`\n✨ ${restaurantsUpdated} restaurantes atualizados\n`);

  // Atualizar clientes fixos
  const fixedClients = await prisma.fixedClient.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });

  console.log(`📍 Encontrados ${fixedClients.length} clientes fixos sem coordenadas`);

  let fixedClientsUpdated = 0;
  for (const client of fixedClients) {
    // Para clientes fixos, pode ter endereço do restaurante ou clientAddress
    let address = client.clientAddress;
    if (client.restaurantId && !address) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: client.restaurantId },
        select: { address: true }
      });
      if (restaurant) {
        address = restaurant.address;
      }
    }
    
    const coords = getCoordinatesFromAddress(address);
    
    if (coords) {
      await prisma.fixedClient.update({
        where: { id: client.id },
        data: {
          latitude: coords.latitude,
          longitude: coords.longitude
        }
      });
      fixedClientsUpdated++;
      const clientName = client.clientName || client.restaurantId || 'Cliente sem nome';
      console.log(`✅ ${clientName}: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } else {
      const clientName = client.clientName || client.restaurantId || 'Cliente sem nome';
      console.log(`⚠️  ${clientName}: sem coordenadas válidas`);
    }
  }

  console.log(`\n✨ ${fixedClientsUpdated} clientes fixos atualizados`);
  console.log('\n🎉 População de coordenadas concluída!');
}

populateCoordinates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

