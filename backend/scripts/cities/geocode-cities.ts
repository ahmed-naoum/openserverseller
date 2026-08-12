/**
 * Fills in coordinates for cities the OSM place dump did not cover — mostly
 * Coliaty destinations spelled differently from any OSM node, plus localities
 * that only appear in our own order history.
 *
 * Uses Nominatim, the OpenStreetMap geocoder. Its usage policy caps automated
 * clients at one request per second with an identifying User-Agent, so this is
 * deliberately slow: budget roughly one minute per 60 cities.
 *
 * Safe to re-run — it only touches rows with no coordinates, and never
 * overwrites a `manual` position an admin set from the map picker.
 *
 * Usage: npx tsx scripts/cities/geocode-cities.ts [--limit=100] [--retry-failed]
 */
import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'silacod-city-import/1.0 (delivery city catalogue; contact: admin@silacod.ma)';

/** Nominatim's published rate limit is 1 req/s; the margin avoids a soft ban. */
const REQUEST_INTERVAL_MS = 1_100;

/** Morocco + Western Sahara, used to reject a geocode that landed elsewhere. */
const BOUNDS = { minLat: 20.5, maxLat: 36.2, minLon: -17.5, maxLon: -0.9 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

interface NominatimResult {
  lat: string;
  lon: string;
  type: string;
  class: string;
  display_name: string;
  address?: Record<string, string>;
}

/** "HUB BENIMELLAL" / "Hub Settat - Berchid" -> "Beni Mellal" / "Settat". */
const hubToRegion = (hub?: string | null): string | null => {
  if (!hub) return null;
  const cleaned = hub
    .replace(/^hub\s*/i, '')
    .split('-')[0]
    .trim()
    .toLowerCase();
  const known: Record<string, string> = {
    benimellal: 'Beni Mellal', ouarzazat: 'Ouarzazate', 'al hoceïma': 'Al Hoceima',
    'al hoceima': 'Al Hoceima', meknes: 'Meknes', laayoune: 'Laayoune',
    errachidia: 'Errachidia', kenitra: 'Kenitra', settat: 'Settat',
  };
  return known[cleaned] || (cleaned ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) : null);
};

/**
 * Coliaty's city names are operator-entered and carry noise no geocoder can
 * match: a province glued on with a dash ("Agouim-OUARZAZAT", "Rich - Errachidia"),
 * Arabic-chat digits standing in for letters ("Ain Na9bi", "Oulad I3ich"), and
 * the odd "Douar" prefix. Each cleanup is tried as a separate query rather than
 * applied blindly, so a name that was already correct is still tried verbatim first.
 */
function nameVariants(name: string, hub?: string | null): string[] {
  const variants: string[] = [name];

  // Arabic chat alphabet: 9→q, 3→a, 7→h, 2→a.
  if (/[2379]/.test(name)) {
    variants.push(name.replace(/9/g, 'q').replace(/3/g, 'a').replace(/7/g, 'h').replace(/2/g, 'a'));
  }

  // Strip a dash-appended province and try the bare locality.
  if (name.includes('-')) {
    const [head, tail] = name.split('-').map((s) => s.trim());
    if (head.length >= 3) variants.push(head);
    // Sometimes the province comes first ("Nkoub-ZAGORA" vs "SIDI CHAFII-Rabat").
    if (tail && tail.length >= 3) variants.push(tail);
  }

  // "Douar X" is "hamlet X"; the geocoder knows the bare name more often.
  if (/^douar\s+/i.test(name)) variants.push(name.replace(/^douar\s+/i, ''));

  const region = hubToRegion(hub);
  if (region) {
    // The hub narrows a small locality to its province, which is what makes an
    // otherwise ambiguous douar findable.
    for (const v of [...variants]) variants.push(`${v}, ${region}`);
  }

  return [...new Set(variants.map((v) => v.trim()).filter((v) => v.length >= 3))];
}

async function geocode(name: string): Promise<NominatimResult | null> {
  const attempts = [
    { q: `${name}, Morocco`, structured: false },
    // The structured form is the fallback because it is stricter: it will not
    // match a street or business that happens to share the city's name.
    { city: name, country: 'Morocco', structured: true },
  ];

  for (const attempt of attempts) {
    try {
      const params: Record<string, string> = {
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'ma,eh',
        addressdetails: '1',
      };
      if (attempt.structured) {
        params.city = attempt.city!;
        params.country = attempt.country!;
      } else {
        params.q = attempt.q!;
      }

      const res = await axios.get<NominatimResult[]>(NOMINATIM, {
        params,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fr,en' },
        timeout: 20_000,
      });

      await sleep(REQUEST_INTERVAL_MS);

      const hit = res.data?.[0];
      if (!hit) continue;

      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (
        lat < BOUNDS.minLat || lat > BOUNDS.maxLat ||
        lon < BOUNDS.minLon || lon > BOUNDS.maxLon
      ) {
        console.warn(`  ! ${name}: result outside Morocco (${lat}, ${lon}) — rejected`);
        continue;
      }

      return { ...hit, lat: String(lat), lon: String(lon) };
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429 || status === 503) {
        console.warn('  ! rate limited, backing off 30s');
        await sleep(30_000);
      } else {
        console.warn(`  ! ${name}: ${err.message}`);
        await sleep(REQUEST_INTERVAL_MS);
      }
    }
  }

  return null;
}

async function main() {
  const limit = Number(arg('limit')) || undefined;
  const retryFailed = process.argv.includes('--retry-failed');

  const targets = await prisma.city.findMany({
    where: retryFailed
      ? { latitude: null }
      : { latitude: null, geoSource: null },
    // Deliverable cities first: those are the ones agents actually dispatch to,
    // so a partial run still leaves the important half of the table mapped.
    orderBy: [{ isDeliverable: 'desc' }, { name: 'asc' }],
    take: limit,
    select: { id: true, name: true, coliatyName: true, hubName: true },
  });

  if (!targets.length) {
    console.log('Nothing to geocode.');
    return;
  }

  const eta = Math.ceil((targets.length * REQUEST_INTERVAL_MS) / 60_000);
  console.log(`Geocoding ${targets.length} cities via Nominatim (~${eta} min)...`);

  let found = 0;
  let failed = 0;

  for (const [i, city] of targets.entries()) {
    let result: NominatimResult | null = null;
    for (const variant of nameVariants(city.name, city.hubName)) {
      result = await geocode(variant);
      if (result) break;
    }

    if (result) {
      await prisma.city.update({
        where: { id: city.id },
        data: {
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          geoSource: 'nominatim',
          placeType: result.type,
          province: result.address?.province || result.address?.state || undefined,
          region: result.address?.state || undefined,
        },
      });
      found++;
    } else {
      // Marked so a plain re-run skips it; --retry-failed picks it back up.
      await prisma.city.update({ where: { id: city.id }, data: { geoSource: 'failed' } });
      failed++;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${targets.length} — ${found} found, ${failed} failed`);
    }
  }

  console.log(`\nDone: ${found} geocoded, ${failed} not found.`);

  const remaining = await prisma.city.count({ where: { latitude: null } });
  console.log(`Cities still without coordinates: ${remaining}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
