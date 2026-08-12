/**
 * Builds the `cities` table. Re-runnable: every phase upserts, so running it
 * again after Coliaty adds a city updates rather than duplicates.
 *
 * Phases, in dependency order:
 *   1. OSM      — 6k Moroccan localities, each with coordinates already attached
 *   2. Coliaty  — the ~451 deliverable cities, matched onto OSM rows for lat/lng
 *   3. Observed — real city names sitting in our own leads/orders/profiles that
 *                 neither source lists, so historical records stay resolvable
 *   4. Aliases  — every spelling variant we have seen, pointed at its canonical row
 *
 * Coordinates for anything still unplaced are filled in separately by
 * geocode-cities.ts, which is slow (Nominatim allows 1 request/second).
 *
 * Usage: npx tsx scripts/cities/import-cities.ts [--phase=osm,coliaty,observed,aliases]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { citySlug, cleanCityName, isPlausibleCityName, matchCity } from '../../src/lib/cityMatch.js';

const prisma = new PrismaClient();

const OSM_FILE = path.join(__dirname, 'data', 'osm-places.json');

interface OsmPlace {
  osmId: number;
  name: string;
  nameAr?: string;
  nameFr?: string;
  nameEn?: string;
  place: string;
  lat: number;
  lon: number;
  population?: number;
}

interface ColiatyCity {
  city_id: number;
  city_name: string;
  city_code: string;
  hub_id: number;
  hub_name: string;
}

const requestedPhases = (() => {
  const arg = process.argv.find((a) => a.startsWith('--phase='));
  if (!arg) return null;
  return new Set(arg.slice('--phase='.length).split(',').map((s) => s.trim()));
})();

const shouldRun = (phase: string) => !requestedPhases || requestedPhases.has(phase);

/* ------------------------------------------------------------------ phase 1 */

/**
 * OSM is imported first and only where a slug is not already taken.
 *
 * Where the same slug appears more than once — a village and a suburb sharing a
 * name — the larger settlement wins, since that is the one a customer ordering
 * from "Sidi Moussa" almost certainly means.
 */
async function importOsm(): Promise<number> {
  if (!fs.existsSync(OSM_FILE)) {
    console.warn('[osm] no data file; run fetch-osm-places.ts first. Skipping.');
    return 0;
  }

  const places: OsmPlace[] = JSON.parse(fs.readFileSync(OSM_FILE, 'utf8'));
  const rank: Record<string, number> = { city: 0, town: 1, suburb: 2, village: 3, hamlet: 4 };

  const bySlug = new Map<string, OsmPlace>();
  for (const place of places) {
    // Slugged from the same string that becomes the display name, so the two can
    // never disagree about which row a place belongs to.
    const displayName = cleanCityName(place.nameFr || place.name);
    const slug = citySlug(displayName);
    if (!slug || !isPlausibleCityName(displayName)) continue;

    const existing = bySlug.get(slug);
    if (
      !existing ||
      rank[place.place] < rank[existing.place] ||
      (place.population || 0) > (existing.population || 0)
    ) {
      bySlug.set(slug, place);
    }
  }

  console.log(`[osm] ${places.length} places -> ${bySlug.size} distinct localities`);

  let written = 0;
  for (const [slug, place] of bySlug) {
    const name = cleanCityName(place.nameFr || place.name);
    await prisma.city.upsert({
      where: { slug },
      create: {
        slug,
        name,
        nameAr: place.nameAr,
        nameFr: place.nameFr,
        nameEn: place.nameEn,
        latitude: place.lat,
        longitude: place.lon,
        geoSource: 'osm',
        placeType: place.place,
        osmId: BigInt(place.osmId),
        population: place.population,
        isMajor: place.place === 'city',
        source: 'osm',
      },
      // Coordinates an admin corrected by hand must survive a re-import, so a
      // refresh only fills gaps and never overwrites `manual`.
      update: {
        nameAr: place.nameAr ?? undefined,
        nameEn: place.nameEn ?? undefined,
        placeType: place.place,
        population: place.population ?? undefined,
      },
    });
    written++;
  }

  console.log(`[osm] upserted ${written} cities`);
  return written;
}

/* ------------------------------------------------------------------ phase 2 */

async function fetchColiatyCities(): Promise<ColiatyCity[]> {
  const cached = path.join(__dirname, 'data', 'coliaty-cities.json');
  const base = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

  try {
    const res = await axios.post(
      `${base}/cities/getCities`,
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.COLIATY_PUBLIC_KEY}:${process.env.COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'X-HTTP-Method-Override': 'GET',
        },
        timeout: 30_000,
      }
    );
    const list: ColiatyCity[] = res.data?.data || [];
    if (!list.length) throw new Error('empty city list');
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, JSON.stringify(list, null, 2));
    return list;
  } catch (err: any) {
    // A carrier outage must not wipe the deliverable flags off every city, so
    // the last good response is reused instead of importing an empty list.
    console.warn(`[coliaty] live fetch failed (${err.message}); falling back to cache`);
    if (!fs.existsSync(cached)) throw err;
    return JSON.parse(fs.readFileSync(cached, 'utf8'));
  }
}

/**
 * Overlays Coliaty onto the OSM base so a city OSM already placed keeps its
 * coordinates and simply gains its carrier id and hub.
 *
 * Runs in three passes rather than one, because a single pass loses cities: a
 * fuzzy match can claim the exact row a later city needed. "Boulmane" reaching
 * "Boulemane" first left the real "Boulemane" with nowhere to go, and since
 * coliatyCityId lives on the city row the second write silently overwrote the
 * first — a city that can no longer be dispatched to. Exact matches are
 * therefore resolved for every city before any fuzzy match is attempted, and a
 * row can only ever be claimed once.
 */
async function importColiaty(): Promise<number> {
  const raw = await fetchColiatyCities();

  // Coliaty lists a handful of cities twice under different ids ("Aghmat" and
  // "Aghmat", "Ain Allah" and "ain allah"). They are the same destination, so
  // the first id wins and the rest are reported rather than turned into
  // duplicate rows.
  const cities: ColiatyCity[] = [];
  const seen = new Map<string, ColiatyCity>();
  const duplicates: string[] = [];
  for (const city of raw) {
    const slug = citySlug(cleanCityName(city.city_name));
    if (!slug) continue;
    const first = seen.get(slug);
    if (first) {
      duplicates.push(`${city.city_name} (#${city.city_id}) == ${first.city_name} (#${first.city_id})`);
      continue;
    }
    seen.set(slug, city);
    cities.push(city);
  }

  console.log(`[coliaty] ${raw.length} from carrier -> ${cities.length} distinct`);
  if (duplicates.length) {
    console.log(`[coliaty] ${duplicates.length} duplicate listings ignored:`);
    duplicates.forEach((d) => console.log(`    ${d}`));
  }

  // Cleared before re-linking so a city the carrier dropped, or one that a
  // previous run attached to the wrong row, does not stay marked deliverable
  // with a stale carrier id.
  await prisma.city.updateMany({
    where: { coliatyCityId: { not: null } },
    data: { coliatyCityId: null, coliatyName: null, coliatyCode: null, hubId: null, hubName: null, isDeliverable: false },
  });

  const candidates = await prisma.city.findMany({ select: { id: true, slug: true, name: true } });
  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  const claimed = new Set<number>();

  const link = async (cityRowId: number, city: ColiatyCity) => {
    await prisma.city.update({
      where: { id: cityRowId },
      data: {
        coliatyCityId: city.city_id,
        coliatyName: city.city_name,
        coliatyCode: city.city_code,
        hubId: city.hub_id,
        hubName: city.hub_name,
        isDeliverable: true,
      },
    });
    claimed.add(cityRowId);
  };

  // Pass 1 — exact slug. Unambiguous, so it gets first refusal on every row.
  const unmatched: ColiatyCity[] = [];
  let exact = 0;
  for (const city of cities) {
    const hit = bySlug.get(citySlug(cleanCityName(city.city_name)));
    if (hit && !claimed.has(hit.id)) {
      await link(hit.id, city);
      exact++;
    } else {
      unmatched.push(city);
    }
  }

  // Pass 2 — fuzzy, over unclaimed rows only. Catches transliteration drift
  // between the carrier and OSM ("Beni Ansar" vs "Beni Ensar").
  const stillUnmatched: ColiatyCity[] = [];
  let fuzzy = 0;
  for (const city of unmatched) {
    const pool = candidates.filter((c) => !claimed.has(c.id));
    const hit = matchCity(cleanCityName(city.city_name), pool);
    if (hit) {
      await link(hit.id, city);
      fuzzy++;
    } else {
      stillUnmatched.push(city);
    }
  }

  // Pass 3 — the carrier knows about a place OSM does not. It still has to be
  // deliverable, so it gets its own row and geocode-cities.ts will place it.
  let created = 0;
  for (const city of stillUnmatched) {
    const cleaned = cleanCityName(city.city_name);
    const slug = citySlug(cleaned);
    if (!slug || bySlug.has(slug)) continue;

    const record = await prisma.city.create({
      data: {
        slug,
        // Coliaty stores some names fully capitalised ("AGADIR"); the carrier
        // spelling is kept in coliatyName for dispatch and the display name is
        // cased for humans.
        name: toDisplayCase(cleaned),
        coliatyCityId: city.city_id,
        coliatyName: city.city_name,
        coliatyCode: city.city_code,
        hubId: city.hub_id,
        hubName: city.hub_name,
        isDeliverable: true,
        source: 'coliaty',
      },
    });
    bySlug.set(slug, { id: record.id, slug, name: record.name });
    candidates.push({ id: record.id, slug, name: record.name });
    claimed.add(record.id);
    created++;
  }

  const total = exact + fuzzy + created;
  console.log(`[coliaty] linked ${total}/${cities.length}: ${exact} exact, ${fuzzy} fuzzy, ${created} new`);
  if (total !== cities.length) {
    console.warn(`[coliaty] WARNING: ${cities.length - total} carrier cities unlinked`);
  }
  return total;
}

const toDisplayCase = (raw: string): string => {
  // Only rewrite names that are entirely upper or lower case; anything already
  // mixed ("El Jadida", "Sidi Bennour") is left exactly as the source wrote it.
  if (raw !== raw.toUpperCase() && raw !== raw.toLowerCase()) return raw;
  return raw
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length <= 1 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
};

/* ------------------------------------------------------------------ phase 3 */

/**
 * Adds cities that only exist in our own records.
 *
 * These are real orders that were delivered somehow, so dropping the name would
 * make historical leads unresolvable. Junk submissions from public landing pages
 * are filtered out by isPlausibleCityName, and anything close enough to an
 * existing row becomes an alias in phase 4 rather than a new city.
 */
async function importObserved(): Promise<number> {
  const [leads, orders, profiles] = await Promise.all([
    prisma.lead.findMany({ select: { city: true }, where: { city: { not: null } } }),
    prisma.order.findMany({ select: { customerCity: true } }),
    prisma.userProfile.findMany({ select: { city: true }, where: { city: { not: null } } }),
  ]);

  const observed = new Map<string, string>();
  for (const raw of [
    ...leads.map((l) => l.city),
    ...orders.map((o) => o.customerCity),
    ...profiles.map((p) => p.city),
  ]) {
    if (!raw) continue;
    const cleaned = cleanCityName(raw);
    const slug = citySlug(cleaned);
    if (slug && !observed.has(slug)) observed.set(slug, cleaned);
  }

  const existing = await prisma.city.findMany({ select: { id: true, slug: true } });
  const existingSlugs = new Set(existing.map((c) => c.slug));

  let created = 0;
  let rejected = 0;

  for (const [slug, name] of observed) {
    if (existingSlugs.has(slug)) continue;

    // A near-match to a known city is a spelling variant, not a new place — it
    // is recorded as an alias in phase 4.
    if (matchCity(name, existing)) continue;

    if (!isPlausibleCityName(name)) {
      rejected++;
      continue;
    }

    await prisma.city.create({
      data: { slug, name: toDisplayCase(name), source: 'observed', isDeliverable: false },
    });
    created++;
  }

  console.log(`[observed] ${observed.size} distinct values -> ${created} new cities, ${rejected} junk rejected`);
  return created;
}

/* ------------------------------------------------------------------ phase 4 */

/**
 * Records every spelling variant we have actually seen, so the next lead that
 * arrives with "Tangier" resolves without a fuzzy search at request time.
 */
async function importAliases(): Promise<number> {
  const cities = await prisma.city.findMany({
    select: { id: true, slug: true, name: true, coliatyName: true, nameAr: true, nameFr: true, nameEn: true },
  });
  const bySlug = new Map(cities.map((c) => [c.slug, c]));

  const aliases = new Map<string, { alias: string; cityId: number; source: string }>();

  const add = (raw: string | null | undefined, cityId: number, source: string) => {
    if (!raw) return;
    const cleaned = cleanCityName(raw);
    const slug = citySlug(cleaned);
    // A variant that already resolves on its own is not worth a row.
    if (!slug || bySlug.has(slug) || aliases.has(slug)) return;
    aliases.set(slug, { alias: cleaned, cityId, source });
  };

  // Translations and the carrier's own spelling are aliases by construction.
  for (const city of cities) {
    add(city.coliatyName, city.id, 'coliaty');
    add(city.nameAr, city.id, 'osm');
    add(city.nameFr, city.id, 'osm');
    add(city.nameEn, city.id, 'osm');
  }

  // Then everything our own data spells differently from the canonical row.
  const [leads, orders, profiles] = await Promise.all([
    prisma.lead.findMany({ select: { city: true }, where: { city: { not: null } } }),
    prisma.order.findMany({ select: { customerCity: true } }),
    prisma.userProfile.findMany({ select: { city: true }, where: { city: { not: null } } }),
  ]);

  const candidates = cities.map((c) => ({ id: c.id, slug: c.slug }));

  for (const raw of [
    ...leads.map((l) => l.city),
    ...orders.map((o) => o.customerCity),
    ...profiles.map((p) => p.city),
  ]) {
    if (!raw) continue;
    const cleaned = cleanCityName(raw);
    if (!isPlausibleCityName(cleaned)) continue;
    const hit = matchCity(cleaned, candidates);
    if (hit) add(cleaned, hit.id, 'observed');
  }

  let written = 0;
  for (const [slug, entry] of aliases) {
    await prisma.cityAlias.upsert({
      where: { slug },
      create: { slug, alias: entry.alias, cityId: entry.cityId, source: entry.source },
      update: { alias: entry.alias, cityId: entry.cityId },
    });
    written++;
  }

  console.log(`[aliases] upserted ${written} aliases`);
  return written;
}

/* ------------------------------------------------------------------ phase 5 */

/**
 * Applies hand corrections from data/overrides.json.
 *
 * Some mistakes are not derivable. Coliaty's "Awrir" and OSM's "Aourir" are the
 * same coastal town north of Agadir, but the two slugs are 5 and 6 characters
 * apart in a way the fuzzy matcher deliberately will not bridge — at that length
 * a one-edit tolerance would also merge genuinely distinct places. So the split
 * row got its own Nominatim lookup and landed 200km away in the High Atlas.
 *
 * Runs last, and always, so a correction cannot be undone by a later re-import.
 */
async function applyOverrides(): Promise<number> {
  const file = path.join(__dirname, 'data', 'overrides.json');
  if (!fs.existsSync(file)) return 0;

  const overrides = JSON.parse(fs.readFileSync(file, 'utf8'));
  let applied = 0;

  for (const [fromSlug, toSlug] of Object.entries(overrides.mergeInto || {})) {
    const from = await prisma.city.findUnique({ where: { slug: fromSlug } });
    const to = await prisma.city.findUnique({ where: { slug: String(toSlug) } });

    if (!to) {
      console.warn(`[overrides] target "${toSlug}" not found, skipping merge of "${fromSlug}"`);
      continue;
    }
    if (!from) continue; // already merged by a previous run

    // The carrier linkage has to move before the duplicate is deleted, and
    // coliatyCityId is unique, so the source row is cleared first.
    await prisma.city.update({
      where: { id: from.id },
      data: { coliatyCityId: null, isDeliverable: false },
    });
    await prisma.city.update({
      where: { id: to.id },
      data: {
        coliatyCityId: from.coliatyCityId,
        coliatyName: from.coliatyName,
        coliatyCode: from.coliatyCode,
        hubId: from.hubId,
        hubName: from.hubName,
        isDeliverable: from.isDeliverable || to.isDeliverable,
      },
    });
    await prisma.cityAlias.deleteMany({ where: { cityId: from.id } });
    await prisma.city.delete({ where: { id: from.id } });
    // The old spelling still arrives on leads, so it has to keep resolving.
    await prisma.cityAlias.upsert({
      where: { slug: fromSlug },
      create: { slug: fromSlug, alias: from.name, cityId: to.id, source: 'manual' },
      update: { alias: from.name, cityId: to.id, source: 'manual' },
    });

    console.log(`[overrides] merged "${from.name}" -> "${to.name}" (${to.latitude}, ${to.longitude})`);
    applied++;
  }

  for (const [slug, pos] of Object.entries<any>(overrides.coordinates || {})) {
    const city = await prisma.city.findUnique({ where: { slug } });
    if (!city) {
      console.warn(`[overrides] "${slug}" not found, skipping coordinate override`);
      continue;
    }
    await prisma.city.update({
      where: { id: city.id },
      data: { latitude: pos.lat, longitude: pos.lon, geoSource: 'manual' },
    });
    console.log(`[overrides] pinned "${city.name}" to ${pos.lat}, ${pos.lon}${pos.note ? ` — ${pos.note}` : ''}`);
    applied++;
  }

  console.log(`[overrides] applied ${applied} correction(s)`);
  return applied;
}

/* --------------------------------------------------------------------- main */

async function main() {
  // Bootstrap guard for deploy.sh. A populated table is left alone, so this
  // costs one COUNT on a normal deploy; an empty one gets filled, which is the
  // only state that produces a platform-wide empty city picker.
  if (process.argv.includes('--if-empty')) {
    const existing = await prisma.city.count();
    if (existing > 0) {
      console.log(`[cities] ${existing} cities already present — nothing to do.`);
      return;
    }
    console.log('[cities] table is empty — running first import.');
  }

  if (shouldRun('osm')) await importOsm();
  if (shouldRun('coliaty')) await importColiaty();
  if (shouldRun('observed')) await importObserved();
  if (shouldRun('aliases')) await importAliases();
  // Never gated by --phase: a hand correction must apply on every run, or a
  // partial re-import would silently reintroduce the mistake it fixed.
  await applyOverrides();

  const [total, deliverable, geocoded] = await Promise.all([
    prisma.city.count(),
    prisma.city.count({ where: { isDeliverable: true } }),
    prisma.city.count({ where: { latitude: { not: null } } }),
  ]);

  console.log('\n=== cities table ===');
  console.log(`total       : ${total}`);
  console.log(`deliverable : ${deliverable} (Coliaty)`);
  console.log(`geocoded    : ${geocoded}`);
  console.log(`missing geo : ${total - geocoded}  -> run geocode-cities.ts`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
