/**
 * Finds cities whose stored position disagrees with the hub that serves them.
 *
 * A hub covers a compact area, so a city sitting far from the rest of its hub is
 * almost always a geocoding mistake rather than a real outlier — which is exactly
 * how "Awrir" was caught sitting in the High Atlas while its hub was Agadir.
 *
 * The hub centre is the *median* of its members, not the mean, so a handful of
 * already-wrong cities cannot drag the reference point toward themselves.
 *
 * Usage: npx tsx scripts/cities/audit-hubs.ts [--json] [--threshold=120]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

/** Great-circle distance in km. */
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

async function main() {
  const threshold = Number(arg('threshold')) || 120;

  const cities = await prisma.city.findMany({
    where: { isDeliverable: true },
    select: {
      id: true, name: true, coliatyName: true, hubName: true, region: true,
      latitude: true, longitude: true, geoSource: true,
    },
    orderBy: { name: 'asc' },
  });

  const hubs = new Map<string, typeof cities>();
  for (const city of cities) {
    const hub = city.hubName || '(no hub)';
    hubs.set(hub, [...(hubs.get(hub) || []), city]);
  }

  const report = [...hubs.entries()]
    .map(([hub, members]) => {
      const placed = members.filter((m) => m.latitude != null && m.longitude != null);
      const centre = placed.length
        ? { lat: median(placed.map((m) => m.latitude!)), lon: median(placed.map((m) => m.longitude!)) }
        : null;

      const withDistance = members.map((m) => ({
        id: m.id,
        name: m.name,
        coliatyName: m.coliatyName,
        region: m.region,
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
        centre,
        total: members.length,
        unplaced: members.filter((m) => m.latitude == null).length,
        cities: withDistance.sort((a, b) => (b.distanceKm ?? -1) - (a.distanceKm ?? -1)),
        suspects: withDistance.filter((c) => (c.distanceKm ?? 0) > threshold).length,
      };
    })
    .sort((a, b) => b.suspects - a.suspects || a.hub.localeCompare(b.hub));

  if (process.argv.includes('--json')) {
    const out = path.join(__dirname, 'data', 'hub-audit.json');
    fs.writeFileSync(out, JSON.stringify({ threshold, hubs: report }, null, 2));
    console.log(`wrote ${out}`);
  }

  const totalSuspects = report.reduce((n, h) => n + h.suspects, 0);
  console.log(`${cities.length} deliverable cities across ${report.length} hubs`);
  console.log(`${totalSuspects} sitting more than ${threshold}km from their hub's centre\n`);

  for (const hub of report) {
    console.log(
      `${hub.hub}  —  ${hub.total} cities, ${hub.unplaced} unplaced, ${hub.suspects} suspect` +
      (hub.centre ? `  [centre ${hub.centre.lat.toFixed(3)}, ${hub.centre.lon.toFixed(3)}]` : '')
    );
    for (const city of hub.cities.filter((c) => (c.distanceKm ?? 0) > threshold)) {
      console.log(
        `    ${String(city.distanceKm).padStart(5)}km  ${city.name.padEnd(28)} ` +
        `${city.latitude?.toFixed(4)},${city.longitude?.toFixed(4)}  (${city.geoSource})`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
