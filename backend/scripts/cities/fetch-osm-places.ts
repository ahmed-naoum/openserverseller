/**
 * Downloads every named Moroccan locality from OpenStreetMap via Overpass.
 *
 * This is the coordinate source for the whole city table: OSM already carries a
 * lat/lon for each place, so matching a Coliaty city to an OSM node gives us its
 * position for free and keeps the slow Nominatim geocoder for the leftovers.
 *
 * Output: scripts/cities/data/osm-places.json (committed so a rebuild of the
 * table does not depend on Overpass being up).
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const OUT_DIR = path.join(__dirname, 'data');
const OUT_FILE = path.join(OUT_DIR, 'osm-places.json');

// Mirrors are rotated because a single Overpass instance rate-limits hard on a
// country-wide query and answers 429 rather than queueing.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

// Overpass and Nominatim both reject requests without a descriptive User-Agent.
const USER_AGENT = 'silacod-city-import/1.0 (delivery city catalogue; contact: admin@silacod.ma)';

// `hamlet` is deliberately excluded: OSM has ~6.4k of them for this region and
// they are farm clusters rather than addressable delivery destinations, so they
// would triple the dropdown without adding a single shippable place.
const PLACE_FILTER = '^(city|town|village|suburb)$';

// The area lookup is the accurate one but depends on the mirror having the
// Morocco relation indexed; the bounding box is a dumb fallback that always
// works. Extra coverage from neighbouring territory is dropped at import time
// by requiring a match against a Moroccan city name.
const AREA_QUERY = `
[out:json][timeout:600];
area["ISO3166-1"="MA"][admin_level=2]->.ma;
(
  node["place"~"${PLACE_FILTER}"]["name"](area.ma);
);
out body;
`;

const BBOX_QUERY = `
[out:json][timeout:600];
(
  node["place"~"${PLACE_FILTER}"]["name"](20.5,-17.4,36.2,-0.8);
);
out body;
`;

export interface OsmPlace {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(): Promise<void> {
  let lastError: unknown;

  // Every mirror gets a shot at the accurate area query before any mirror falls
  // back to the bounding box, which over-reaches into Algeria and Mauritania.
  const attempts = [
    ...ENDPOINTS.map((endpoint) => ({ endpoint, query: AREA_QUERY, kind: 'area' })),
    ...ENDPOINTS.map((endpoint) => ({ endpoint, query: BBOX_QUERY, kind: 'bbox' })),
  ];

  for (const [i, attempt] of attempts.entries()) {
    try {
      console.log(`[osm] querying ${attempt.endpoint} (${attempt.kind}) ...`);
      const res = await axios.post(attempt.endpoint, `data=${encodeURIComponent(attempt.query)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        timeout: 600_000,
      });

      const places: OsmPlace[] = (res.data?.elements || [])
        .filter((el: any) => el.tags?.name && typeof el.lat === 'number')
        .map((el: any) => ({
          osmId: el.id,
          name: el.tags.name,
          nameAr: el.tags['name:ar'],
          nameFr: el.tags['name:fr'],
          nameEn: el.tags['name:en'],
          place: el.tags.place,
          lat: el.lat,
          lon: el.lon,
          population: el.tags.population ? Number(el.tags.population) || undefined : undefined,
        }));

      if (!places.length) throw new Error('Overpass returned no places');

      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(OUT_FILE, JSON.stringify(places, null, 2));

      const byType = places.reduce<Record<string, number>>((acc, p) => {
        acc[p.place] = (acc[p.place] || 0) + 1;
        return acc;
      }, {});
      console.log(`[osm] saved ${places.length} places -> ${OUT_FILE}`);
      console.log('[osm] by type:', byType);
      return;
    } catch (err: any) {
      lastError = err;
      console.warn(`[osm] ${attempt.endpoint} (${attempt.kind}) failed: ${err.response?.status || ''} ${err.message}`);
      // 429 means the mirror is throttling us, not that the query is wrong —
      // backing off is what lets the next attempt succeed.
      if (i < attempts.length - 1) await sleep(err.response?.status === 429 ? 20_000 : 3_000);
    }
  }

  throw lastError;
}

run().catch((err) => {
  console.error('[osm] all mirrors failed:', err.message);
  process.exit(1);
});
