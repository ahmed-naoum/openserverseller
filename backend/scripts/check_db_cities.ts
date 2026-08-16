import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const coliatyJsonPath = path.join(process.cwd(), 'scripts', 'cities', 'data', 'coliaty-cities.json');
  const coliatyRaw: any[] = JSON.parse(fs.readFileSync(coliatyJsonPath, 'utf8'));

  const totalCitiesInDb = await prisma.city.count();
  const deliverableInDb = await prisma.city.count({ where: { isDeliverable: true } });
  const withColiatyId = await prisma.city.count({ where: { coliatyCityId: { not: null } } });
  const aliasesCount = await prisma.cityAlias.count();

  console.log('--- DATABASE STATS ---');
  console.log('Total Moroccan Localities in DB:', totalCitiesInDb);
  console.log('Deliverable Cities in DB (isDeliverable=true):', deliverableInDb);
  console.log('Cities with Coliaty City ID linked in DB:', withColiatyId);
  console.log('City Aliases / Spellings in DB:', aliasesCount);
  console.log('Coliaty API Raw Listings in JSON:', coliatyRaw.length);

  const dbColiatyCities = await prisma.city.findMany({
    where: { coliatyCityId: { not: null } },
    select: { id: true, name: true, slug: true, coliatyCityId: true, coliatyName: true, isDeliverable: true, hubName: true }
  });

  const dbColiatyIdSet = new Set(dbColiatyCities.map(c => c.coliatyCityId));
  const missingFromDb = coliatyRaw.filter((c: any) => !dbColiatyIdSet.has(c.city_id));

  console.log('\n--- 7 DUPLICATE LISTINGS IN COLIATY RAW API (451 - 7 = 444) ---');
  console.log('Coliaty API duplicate IDs not stored as separate rows:', missingFromDb.length);
  missingFromDb.forEach((c: any) => {
    console.log(`  - [${c.hub_name}] ${c.city_name} (Coliaty ID: #${c.city_id}, Code: ${c.city_code})`);
  });

  // Check duplicate listings in Coliaty API
  const coliatySlugs = new Map<string, any[]>();
  for (const c of coliatyRaw) {
    const s = c.city_name.toLowerCase().trim();
    if (!coliatySlugs.has(s)) coliatySlugs.set(s, []);
    coliatySlugs.get(s)!.push(c);
  }
  const duplicates = Array.from(coliatySlugs.entries()).filter(([_, arr]) => arr.length > 1);
  console.log(`\nExact Duplicate Name entries inside Coliaty's own API response: ${duplicates.length}`);
  duplicates.forEach(([name, arr]) => {
    console.log(`  - "${name}": IDs [${arr.map(x => `#${x.city_id}`).join(', ')}]`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
