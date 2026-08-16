/**
 * Gathers every measurement the Coliaty-facing audit report prints, into one
 * JSON file, so the PDF builder does nothing but lay out numbers it was handed.
 *
 * Everything here is measured against the carrier's own published catalogue
 * (`data/coliaty-cities.json`, exactly as their API returned it) rather than
 * against our copy of it — an audit that grades our data using our data would
 * agree with itself no matter what was wrong.
 *
 * Read-only. Writes `data/coliaty-audit.json` and changes nothing in the DB.
 *
 *   npx tsx scripts/cities/collect-coliaty-audit.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { citySlug, cleanCityName, matchCity, isPlausibleCityName } from '../../src/lib/cityMatch.js';

const prisma = new PrismaClient();
const HERE = __dirname;
const THRESHOLD = 120;

type CarrierCity = {
  city_id: number;
  city_name: string;
  city_code: string;
  hub_id: number;
  hub_name: string;
};

const carrier: CarrierCity[] = JSON.parse(
  fs.readFileSync(path.join(HERE, 'data', 'coliaty-cities.json'), 'utf8')
);

/**
 * The carrier publishes a few places twice under two different `city_id`s
 * ("Aghmat" is #7382 and #9126, both HUB MARRAKECH). Our side is one row per
 * place — `slug` is unique — so a duplicate pair can only ever link to one of
 * the two ids, and grading against the raw list would score those as misses.
 *
 * They are graded against the *group* instead. That is only safe because every
 * pair sits in the same hub, which is checked rather than assumed: two ids for
 * one name in two different hubs would be a real ambiguity, not a duplicate.
 */
const dupKey = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const carrierGroups = new Map<string, CarrierCity[]>();
for (const c of carrier) {
  const k = dupKey(c.city_name);
  carrierGroups.set(k, [...(carrierGroups.get(k) || []), c]);
}

const duplicateGroups = [...carrierGroups.values()]
  .filter((g) => g.length > 1)
  .map((g) => ({
    name: g[0].city_name,
    sameHub: new Set(g.map((c) => c.hub_id)).size === 1,
    entries: g.map((c) => ({ cityId: c.city_id, name: c.city_name, code: c.city_code, hub: c.hub_name })),
  }));

/** Every `city_id` that names the same place as this one, the id itself included. */
const groupIds = new Map<number, Set<number>>();
for (const g of carrierGroups.values()) {
  const ids = new Set(g.map((c) => c.city_id));
  for (const c of g) groupIds.set(c.city_id, ids);
}

/** Distinct destinations, as opposed to catalogue rows. */
const DISTINCT = carrierGroups.size;

/** Great-circle distance in km. Same formula the placement audit uses. */
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * The variants a real city field actually arrives as.
 *
 * Every one of these is something we have seen in live data rather than an
 * invented worst case: checkout forms that shout, exports that strip accents,
 * Shopify appending the country, agents typing without spaces, and ordinary
 * one-key typos. Each is derived deterministically from the carrier's own
 * spelling so the same run always produces the same test set.
 */
function variants(name: string): { kind: string; input: string }[] {
  const out: { kind: string; input: string }[] = [];
  const plain = name.trim();

  out.push({ kind: 'verbatim', input: plain });
  out.push({ kind: 'uppercase', input: plain.toUpperCase() });
  out.push({ kind: 'lowercase', input: plain.toLowerCase() });
  out.push({
    kind: 'accents stripped',
    input: plain.normalize('NFD').replace(/[̀-ͯ]/g, ''),
  });
  out.push({ kind: 'country appended', input: `${plain}, Maroc` });
  out.push({ kind: 'padded / doubled spaces', input: `  ${plain.replace(/ /g, '  ')}  ` });
  out.push({ kind: 'separators changed', input: plain.replace(/[\s-]+/g, '-') });
  out.push({ kind: 'spaces removed', input: plain.replace(/\s+/g, '') });

  // A single dropped letter, taken from the middle so it is a plausible typo
  // rather than a truncation. Deterministic: same name, same character.
  const letters = plain.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length >= 6) {
    const at = plain.indexOf(letters[Math.floor(letters.length / 2)]);
    if (at > 0) out.push({ kind: 'one letter dropped', input: plain.slice(0, at) + plain.slice(at + 1) });
  }

  return out;
}

async function main() {
  // ------------------------------------------------------------ catalogue

  const cities = await prisma.city.findMany({
    select: {
      id: true, name: true, slug: true, nameAr: true, nameFr: true,
      coliatyCityId: true, coliatyName: true, coliatyCode: true,
      hubId: true, hubName: true, latitude: true, longitude: true,
      geoSource: true, placeType: true, isDeliverable: true, source: true,
      region: true, province: true,
    },
  });

  const deliverable = cities.filter((c) => c.isDeliverable);
  const byColiatyId = new Map(
    deliverable.filter((c) => c.coliatyCityId != null).map((c) => [c.coliatyCityId!, c])
  );

  const aliasRows = await prisma.cityAlias.findMany({
    select: { alias: true, slug: true, cityId: true, source: true },
  });
  const aliasBySlug = new Map(aliasRows.map((a) => [a.slug, a.cityId]));
  const cityById = new Map(cities.map((c) => [c.id, c]));

  // ----------------------------------------------- A. catalogue linkage

  // Does every destination the carrier publishes exist on our side, carrying
  // the carrier's own id, code and hub? An unlinked one is a destination we
  // could not dispatch to at all. A duplicate pair counts as covered when
  // either of its ids is linked — the other is the carrier's own second entry.
  const linkage = [...carrierGroups.values()].map((group) => {
    const linkedEntry = group.find((cc) => byColiatyId.has(cc.city_id));
    const cc = linkedEntry ?? group[0];
    const row = linkedEntry ? byColiatyId.get(cc.city_id)! : null;
    return {
      cityId: cc.city_id,
      carrierName: cc.city_name,
      carrierCode: cc.city_code,
      carrierHub: cc.hub_name,
      duplicateOf: group.length > 1 ? group.filter((g) => g !== cc).map((g) => g.city_id) : null,
      linked: !!row,
      ourName: row?.name ?? null,
      hubMatches: row ? row.hubName === cc.hub_name : false,
      codeMatches: row ? row.coliatyCode === cc.city_code : false,
      nameMatches: row ? row.coliatyName === cc.city_name : false,
    };
  });

  // ------------------------------------------------- B. round-trip test

  // Take the carrier's spelling, push it through the same resolver a live
  // order goes through, and check the parcel would come back out addressed to
  // the same city_id it went in as.
  const candidates = deliverable.map((c) => ({ slug: c.slug, id: c.id, coliatyCityId: c.coliatyCityId }));
  const allCandidates = cities.map((c) => ({ slug: c.slug, id: c.id, coliatyCityId: c.coliatyCityId }));

  const resolve = (raw: string) => {
    const slug = citySlug(cleanCityName(raw));
    const direct = allCandidates.find((c) => c.slug === slug);
    if (direct) return { id: direct.id, via: 'slug' as const };
    const aliasHit = aliasBySlug.get(slug);
    if (aliasHit) return { id: aliasHit, via: 'alias' as const };
    const fuzzy = matchCity(raw, allCandidates);
    if (fuzzy) return { id: fuzzy.id, via: 'fuzzy' as const };
    return null;
  };

  /** True when the resolved row carries this destination's id, or its twin's. */
  const landsOn = (landedColiatyId: number | null | undefined, expected: number) =>
    landedColiatyId != null && (groupIds.get(expected) ?? new Set([expected])).has(landedColiatyId);

  const roundTrip = { total: 0, resolved: 0, correct: 0, via: {} as Record<string, number>, misses: [] as any[] };
  for (const cc of carrier) {
    roundTrip.total++;
    const hit = resolve(cc.city_name);
    if (!hit) {
      roundTrip.misses.push({ input: cc.city_name, cityId: cc.city_id, reason: 'unresolved' });
      continue;
    }
    roundTrip.resolved++;
    roundTrip.via[hit.via] = (roundTrip.via[hit.via] || 0) + 1;
    const landed = cityById.get(hit.id);
    if (landsOn(landed?.coliatyCityId, cc.city_id)) roundTrip.correct++;
    else
      roundTrip.misses.push({
        input: cc.city_name,
        cityId: cc.city_id,
        reason: 'wrong row',
        landedOn: landed?.name ?? null,
        landedColiatyId: landed?.coliatyCityId ?? null,
      });
  }

  // ------------------------------------------------ C. stress / variants

  const stress = {
    byKind: {} as Record<string, { total: number; correct: number; failures: any[] }>,
    total: 0,
    correct: 0,
  };
  for (const cc of carrier) {
    for (const v of variants(cc.city_name)) {
      const bucket = (stress.byKind[v.kind] ||= { total: 0, correct: 0, failures: [] });
      bucket.total++;
      stress.total++;
      const hit = resolve(v.input);
      const landed = hit ? cityById.get(hit.id) : null;
      if (landsOn(landed?.coliatyCityId, cc.city_id)) {
        bucket.correct++;
        stress.correct++;
      } else if (bucket.failures.length < 12) {
        bucket.failures.push({
          input: v.input,
          expected: cc.city_name,
          landedOn: landed?.name ?? null,
        });
      }
    }
  }

  // -------------------------------------------- D. wire-name divergence

  // Rows where what we show a human is not what the carrier publishes. Each of
  // these is a parcel that would leave under a name Coliaty cannot match, if
  // the dispatch layer did not translate it.
  const wireDivergence = deliverable
    .filter((c) => c.coliatyName && c.coliatyName !== c.name)
    .map((c) => ({
      ourName: c.name,
      carrierName: c.coliatyName,
      code: c.coliatyCode,
      cityId: c.coliatyCityId,
      hub: c.hubName,
      // A difference case-folding alone would have absorbed was never a real
      // failure; anything else genuinely left with an unmatched name.
      caseOnly: c.coliatyName!.toLowerCase() === c.name.toLowerCase(),
    }))
    .sort((a, b) => a.ourName.localeCompare(b.ourName));

  // -------------------------------------------------- E. placement audit

  const hubs = new Map<string, typeof deliverable>();
  for (const c of deliverable) {
    const hub = c.hubName || '(no hub)';
    hubs.set(hub, [...(hubs.get(hub) || []), c]);
  }

  const placement = [...hubs.entries()]
    .map(([hub, members]) => {
      const placed = members.filter((m) => m.latitude != null && m.longitude != null);
      const centre = placed.length
        ? { lat: median(placed.map((m) => m.latitude!)), lon: median(placed.map((m) => m.longitude!)) }
        : null;

      const withDistance = members.map((m) => ({
        name: m.name,
        coliatyName: m.coliatyName,
        coliatyCityId: m.coliatyCityId,
        coliatyCode: m.coliatyCode,
        placeType: m.placeType,
        latitude: m.latitude,
        longitude: m.longitude,
        geoSource: m.geoSource,
        distanceKm:
          centre && m.latitude != null && m.longitude != null
            ? Math.round(haversine(centre.lat, centre.lon, m.latitude, m.longitude))
            : null,
      }));

      return {
        hub,
        hubId: members.find((m) => m.hubId != null)?.hubId ?? null,
        centre,
        total: members.length,
        unplaced: members.filter((m) => m.latitude == null).length,
        suspects: withDistance.filter((c) => (c.distanceKm ?? 0) > THRESHOLD).length,
        cities: withDistance.sort((a, b) => (b.distanceKm ?? -1) - (a.distanceKm ?? -1)),
      };
    })
    .sort((a, b) => b.total - a.total || a.hub.localeCompare(b.hub));

  // ----------------------------------------------------- F. live traffic

  const orders = await prisma.order.findMany({ select: { customerCity: true, coliatyPackageCode: true } });
  const leads = await prisma.lead.findMany({ select: { city: true } });

  const tally = (values: (string | null)[]) => {
    const counts = new Map<string, number>();
    for (const v of values) {
      const t = (v || '').trim();
      if (t) counts.set(t, (counts.get(t) || 0) + 1);
    }
    let rows = 0, resolvedRows = 0, deliverableRows = 0;
    const unresolved = new Map<string, number>();
    // Non-deliverable destinations customers actually asked for: the demand
    // signal behind the coverage proposals further down.
    const wanted = new Map<number, number>();
    for (const [text, n] of counts) {
      rows += n;
      const hit = resolve(text);
      const landed = hit ? cityById.get(hit.id) : null;
      if (landed) {
        resolvedRows += n;
        if (landed.isDeliverable) deliverableRows += n;
        else wanted.set(landed.id, (wanted.get(landed.id) || 0) + n);
      } else unresolved.set(text, n);
    }

    // Why a string did not resolve matters more than how many did not. Arabic
    // script is a real coverage gap we can close; keyboard mash never was one.
    const classify = (t: string) =>
      /[؀-ۿ]/.test(t) ? 'arabic script'
      : !isPlausibleCityName(t) ? 'not a place name'
      : 'unrecognised spelling';
    const reasons = new Map<string, { rows: number; distinct: number }>();
    for (const [text, n] of unresolved) {
      const k = classify(text);
      const b = reasons.get(k) || { rows: 0, distinct: 0 };
      reasons.set(k, { rows: b.rows + n, distinct: b.distinct + 1 });
    }

    return {
      rows,
      distinct: counts.size,
      resolvedRows,
      deliverableRows,
      unresolved: [...unresolved.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([text, n]) => ({ text, count: n, reason: classify(text) })),
      unresolvedDistinct: unresolved.size,
      unresolvedReasons: [...reasons.entries()].sort((a, b) => b[1].rows - a[1].rows),
      wanted: [...wanted.entries()],
    };
  };

  const traffic = {
    orders: tally(orders.map((o) => o.customerCity)),
    dispatched: tally(orders.filter((o) => o.coliatyPackageCode).map((o) => o.customerCity)),
    leads: tally(leads.map((l) => l.city)),
  };

  // ----------------------------------------------- G. coverage proposals

  /**
   * Which localities Coliaty does not serve, ranked by what it would cost them
   * to start.
   *
   * Restricted to OpenStreetMap `city`/`town`/`suburb` nodes. The catalogue also
   * holds ~5k villages and douars, and proposing those would bury the handful of
   * real towns in noise — a douar is served through the town next to it, not by
   * its own carrier entry.
   *
   * Distance is measured to the nearest *hub centre*, because that is what
   * decides the cost of adding one: a town inside an existing hub's radius is a
   * catalogue row and nothing else, while one 200km out needs a vehicle.
   */
  const hubCentres = placement
    .filter((h) => h.centre)
    .map((h) => ({ hub: h.hub, hubId: h.hubId, lat: h.centre!.lat, lon: h.centre!.lon }));

  const nearestHub = (lat: number, lon: number) => {
    let best = hubCentres[0];
    let bestKm = Infinity;
    for (const h of hubCentres) {
      const km = haversine(lat, lon, h.lat, h.lon);
      if (km < bestKm) { bestKm = km; best = h; }
    }
    return { hub: best.hub, km: Math.round(bestKm) };
  };

  const demand = new Map<number, number>();
  for (const src of [traffic.orders, traffic.leads]) {
    for (const [cityId, n] of src.wanted) demand.set(cityId, (demand.get(cityId) || 0) + n);
  }

  const SERVEABLE_KM = 60;   // inside an existing hub's working radius today
  const EXTENSION_KM = 120;  // reachable by extending a hub's runs

  // OpenStreetMap classifies far more than settlements, and the `observed` import
  // phase has resolved a few typo'd customer entries onto whatever node carried
  // that name — a café called "Markech", a travel agency, an administrative
  // region. Proposing those to a carrier would discredit the whole list, so the
  // filter is on settlement types rather than on demand alone.
  const SETTLEMENT = new Set(['city', 'town', 'village', 'suburb', 'hamlet']);

  const coverageCandidates = cities
    .filter((c) => !c.isDeliverable && c.latitude != null && c.longitude != null)
    .filter((c) => SETTLEMENT.has(c.placeType || ''))
    // Towns and cities stand on their own; a village earns a line only when
    // somebody has actually tried to order to it.
    .filter((c) => ['city', 'town'].includes(c.placeType!) || demand.has(c.id))
    .map((c) => {
      const near = nearestHub(c.latitude!, c.longitude!);
      return {
        name: c.name,
        placeType: c.placeType,
        region: c.region,
        province: c.province,
        latitude: c.latitude,
        longitude: c.longitude,
        nearestHub: near.hub,
        distanceKm: near.km,
        demandRows: demand.get(c.id) || 0,
        tier: near.km <= SERVEABLE_KM ? 'absorb'
            : near.km <= EXTENSION_KM ? 'extend'
            : 'newHub',
      };
    })
    .sort((a, b) => b.demandRows - a.demandRows || a.distanceKm - b.distanceKm);

  /**
   * Where a new hub would pay for itself.
   *
   * Greedy set cover over the towns no existing hub can reach: repeatedly take
   * the town that brings the most other unreached towns within one hub radius,
   * call that the hub, and drop everything it covers. It is deliberately the
   * simple algorithm — the output is a conversation opener for Coliaty's network
   * team, not a siting decision, and a simple rule is one they can re-run.
   */
  const HUB_RADIUS_KM = 70;
  const uncovered = coverageCandidates.filter((c) => c.tier === 'newHub');
  const remaining = new Set(uncovered.map((_, i) => i));
  const proposedHubs: any[] = [];

  while (remaining.size) {
    let bestIdx = -1;
    let bestCover: number[] = [];
    for (const i of remaining) {
      const cover = [...remaining].filter(
        (j) => haversine(uncovered[i].latitude!, uncovered[i].longitude!,
                         uncovered[j].latitude!, uncovered[j].longitude!) <= HUB_RADIUS_KM
      );
      // Ties broken by observed demand so a hub lands where orders already are.
      const score = cover.length * 1000 + cover.reduce((n, j) => n + uncovered[j].demandRows, 0);
      const bestScore = bestIdx < 0 ? -1
        : bestCover.length * 1000 + bestCover.reduce((n, j) => n + uncovered[j].demandRows, 0);
      if (score > bestScore) { bestIdx = i; bestCover = cover; }
    }
    if (bestIdx < 0) break;

    const seed = uncovered[bestIdx];
    const members = bestCover.map((j) => uncovered[j]);
    proposedHubs.push({
      name: seed.name,
      region: seed.region,
      latitude: seed.latitude,
      longitude: seed.longitude,
      nearestExistingHub: seed.nearestHub,
      kmFromNearestHub: seed.distanceKm,
      covers: members.length,
      demandRows: members.reduce((n, m) => n + m.demandRows, 0),
      cities: members
        .map((m) => ({ name: m.name, placeType: m.placeType, demandRows: m.demandRows,
                       km: Math.round(haversine(seed.latitude!, seed.longitude!, m.latitude!, m.longitude!)) }))
        .sort((a, b) => a.km - b.km),
    });
    for (const j of bestCover) remaining.delete(j);
  }
  proposedHubs.sort((a, b) => b.covers - a.covers || b.demandRows - a.demandRows);

  const proposals = {
    serveableKm: SERVEABLE_KM,
    extensionKm: EXTENSION_KM,
    hubRadiusKm: HUB_RADIUS_KM,
    counts: {
      absorb: coverageCandidates.filter((c) => c.tier === 'absorb').length,
      extend: coverageCandidates.filter((c) => c.tier === 'extend').length,
      newHub: coverageCandidates.filter((c) => c.tier === 'newHub').length,
      withDemand: coverageCandidates.filter((c) => c.demandRows > 0).length,
    },
    cities: coverageCandidates,
    hubs: proposedHubs,
  };

  // ------------------------------------------------------ H. breakdowns

  const countBy = <T>(rows: T[], key: (r: T) => string | null) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r) || 'unclassified';
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    threshold: THRESHOLD,
    totals: {
      localities: cities.length,
      deliverable: deliverable.length,
      nonDeliverable: cities.length - deliverable.length,
      withCoordinates: cities.filter((c) => c.latitude != null).length,
      withoutCoordinates: cities.filter((c) => c.latitude == null).length,
      aliases: aliasRows.length,
      hubs: hubs.size,
      carrierPublished: carrier.length,
      carrierDistinct: DISTINCT,
    },
    duplicateGroups,
    placeTypes: countBy(cities, (c) => c.placeType),
    geoSources: countBy(cities, (c) => c.geoSource),
    aliasSources: countBy(aliasRows, (a) => a.source),
    rowSources: countBy(cities, (c) => c.source),
    linkage: {
      total: linkage.length,
      linked: linkage.filter((l) => l.linked).length,
      hubMatches: linkage.filter((l) => l.hubMatches).length,
      codeMatches: linkage.filter((l) => l.codeMatches).length,
      nameMatches: linkage.filter((l) => l.nameMatches).length,
      broken: linkage.filter((l) => !l.linked || !l.hubMatches || !l.codeMatches || !l.nameMatches),
    },
    roundTrip,
    stress,
    wireDivergence,
    placement,
    traffic,
    proposals,
  };

  const out = path.join(HERE, 'data', 'coliaty-audit.json');
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));

  console.log(`wrote ${out}`);
  console.log(`  catalogue linkage   ${payload.linkage.linked}/${payload.linkage.total} linked, ` +
    `${payload.linkage.hubMatches} hub-consistent, ${payload.linkage.codeMatches} code-consistent`);
  console.log(`  round trip          ${roundTrip.correct}/${roundTrip.total} back to the same city_id ` +
    `(${JSON.stringify(roundTrip.via)})`);
  console.log(`  variant stress      ${stress.correct}/${stress.total} across ${Object.keys(stress.byKind).length} kinds`);
  for (const [kind, b] of Object.entries(stress.byKind)) {
    console.log(`      ${String(b.correct).padStart(4)}/${String(b.total).padEnd(4)}  ${kind}`);
  }
  console.log(`  wire translation    ${wireDivergence.length} cities differ from the carrier spelling ` +
    `(${wireDivergence.filter((w) => !w.caseOnly).length} beyond case)`);
  console.log(`  live traffic        orders ${traffic.orders.resolvedRows}/${traffic.orders.rows}, ` +
    `leads ${traffic.leads.resolvedRows}/${traffic.leads.rows}`);
  console.log(`  placement           ${placement.reduce((n, h) => n + h.suspects, 0)} beyond ${THRESHOLD}km, ` +
    `${placement.reduce((n, h) => n + h.unplaced, 0)} unplaced`);
  console.log(`  carrier duplicates  ${duplicateGroups.length} names published twice ` +
    `(${duplicateGroups.filter((g) => !g.sameHub).length} across different hubs)`);
  console.log(`  proposals           ${proposals.counts.absorb} absorb / ${proposals.counts.extend} extend / ` +
    `${proposals.counts.newHub} need a hub; ${proposals.hubs.length} hub sites; ` +
    `${proposals.counts.withDemand} already asked for`);
  for (const h of proposals.hubs.slice(0, 12)) {
    console.log(`      ${h.name.padEnd(24)} covers ${String(h.covers).padStart(3)} towns, ` +
      `${String(h.demandRows).padStart(3)} orders, ${h.kmFromNearestHub}km from ${h.nearestExistingHub}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
