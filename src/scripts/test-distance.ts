import { calculateDistance, estimateCoordinatesFromCEP, getCoordinatesFromAddress } from '../lib/distance-calculator';

// TESTE 1: Cálculo de distância
console.log('\n🧪 TESTE 1: Cálculo de distância');
console.log('═══════════════════════════════════');

// Teste com coordenadas conhecidas (Av Paulista e Praça da Sé em SP)
const paulista = { lat: -23.5619, lon: -46.6563 };
const se = { lat: -23.5505, lon: -46.6333 };
const distanceTest = calculateDistance(paulista.lat, paulista.lon, se.lat, se.lon);
console.log(`Distância Av Paulista ↔ Praça da Sé: ${distanceTest}km`);
console.log(`Esperado: ~2.5km | ${distanceTest < 3 && distanceTest > 2 ? '✅ OK' : '❌ ERRO'}`);

// TESTE 2: Estimativa por CEP
console.log('\n🧪 TESTE 2: Estimativa por CEP');
console.log('═══════════════════════════════════');

const cepTests = [
  { cep: '01310-100', name: 'Av Paulista, SP', expectedLat: -23.56, expectedLon: -46.66 },
  { cep: '01002-000', name: 'Centro SP', expectedLat: -23.55, expectedLon: -46.63 },
  { cep: '60060-090', name: 'Fortaleza Centro', expectedLat: -3.72, expectedLon: -38.54 }
];

cepTests.forEach(test => {
  const coords = estimateCoordinatesFromCEP(test.cep);
  console.log(`\n${test.name} (${test.cep})`);
  if (coords) {
    console.log(`  Resultado: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    console.log(`  Esperado: ~${test.expectedLat}, ~${test.expectedLon}`);
    const latDiff = Math.abs(coords.latitude - test.expectedLat);
    const lonDiff = Math.abs(coords.longitude - test.expectedLon);
    console.log(`  ${latDiff < 0.1 && lonDiff < 0.1 ? '✅ OK' : '⚠️ IMPRECISO'}`);
  } else {
    console.log('  ❌ FALHOU');
  }
});

// TESTE 3: Conversão de endereço completo
console.log('\n🧪 TESTE 3: Conversão de endereço');
console.log('═══════════════════════════════════');

const addressTests = [
  {
    address: {
      street: 'Avenida Paulista',
      number: '1000',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100'
    }
  },
  {
    address: {
      street: 'Rua do Cliente',
      city: 'São Paulo',
      state: 'SP'
      // Sem CEP
    }
  }
];

addressTests.forEach((test, i) => {
  console.log(`\nEndereço ${i + 1}:`);
  console.log(JSON.stringify(test.address, null, 2));
  const coords = getCoordinatesFromAddress(test.address);
  if (coords) {
    console.log(`✅ Coordenadas: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
  } else {
    console.log('❌ Não conseguiu obter coordenadas');
  }
});

