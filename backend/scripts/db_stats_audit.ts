import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.city.count();
  const deliverable = await prisma.city.count({ where: { isDeliverable: true } });
  const nonDeliverable = await prisma.city.count({ where: { isDeliverable: false } });
  const withCoordinates = await prisma.city.count({ where: { latitude: { not: null }, longitude: { not: null } } });
  const withoutCoordinates = await prisma.city.count({ where: { OR: [{ latitude: null }, { longitude: null }] } });
  const majorCities = await prisma.city.count({ where: { isMajor: true } });
  const aliases = await prisma.cityAlias.count();
  
  // Group by placeType
  const placeTypes = await prisma.city.groupBy({
    by: ['placeType'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  // Group deliverable by hubName
  const hubDeliverable = await prisma.city.groupBy({
    by: ['hubName'],
    where: { isDeliverable: true },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  // Geo source breakdown
  const geoSources = await prisma.city.groupBy({
    by: ['geoSource'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  console.log('=== DATABASE AUDIT COUNTS ===');
  console.log('Total Cities / Localities in DB:', total);
  console.log('Deliverable (Coliaty active):', deliverable);
  console.log('Non-deliverable (OSM / Rural coverage):', nonDeliverable);
  console.log('With GPS Coordinates:', withCoordinates);
  console.log('Without GPS Coordinates:', withoutCoordinates);
  console.log('Major Cities:', majorCities);
  console.log('Total Aliases / Spellings:', aliases);
  console.log('\n--- BY PLACE TYPE ---');
  placeTypes.forEach(p => console.log(`  - ${p.placeType || 'unclassified'}: ${p._count.id}`));
  console.log('\n--- DELIVERABLE BY HUB (Total Hubs: ' + hubDeliverable.length + ') ---');
  hubDeliverable.forEach(h => console.log(`  - ${h.hubName || 'No Hub'}: ${h._count.id}`));
  console.log('\n--- BY GEO SOURCE ---');
  geoSources.forEach(g => console.log(`  - ${g.geoSource || 'unknown'}: ${g._count.id}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
