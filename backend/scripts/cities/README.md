# City catalogue

The `cities` table is the single source of delivery destinations and their map
coordinates. It replaces the eight hand-seeded rows that used to live in
`moroccan_cities`.

## What is in it

| Source     | Rows   | Meaning |
|------------|--------|---------|
| `coliaty`  | ~444   | Cities the carrier ships to. `isDeliverable = true`, carries `coliatyCityId`, `coliatyCode` and `hubName`. |
| `osm`      | ~5.6k  | Every named Moroccan city, town, village and suburb from OpenStreetMap, each with coordinates. |
| `observed` | ~55    | Localities that appear only in our own leads, orders and profiles, so historical records stay resolvable. |

`city_aliases` maps spelling variants ("Tangier", "Casa-anfa", "Agadir, Morocco")
onto the canonical row, which is what lets a lead imported from Shopify or a CSV
resolve without manual correction.

`isDeliverable` is the important flag: a row existing here does **not** mean
Coliaty can ship to it.

## Rebuilding

```bash
npm run cities:sync
```

That runs the import (idempotent — upserts, never duplicates) and then geocodes
anything without coordinates. The phases individually:

```bash
npm run cities:fetch-osm                        # refresh the OSM dump (slow, hits Overpass)
npm run cities:import                           # OSM -> Coliaty -> observed -> aliases
npm run cities:import -- --phase=coliaty        # single phase
npm run cities:geocode                          # fill missing coordinates
npm run cities:geocode -- --retry-failed        # also retry ones that failed before
npm run cities:geocode -- --limit=50            # cap a run
```

`data/osm-places.json` and `data/coliaty-cities.json` are committed so a rebuild
does not depend on Overpass or the carrier API being reachable.

## Coordinates

OpenStreetMap supplies coordinates for the ~5.6k localities it covers. Whatever
is left — mostly Coliaty destinations spelled differently from any OSM node —
goes through Nominatim, which allows **one request per second**, so budget about
a minute per 60 cities.

Coliaty's names are operator-entered and often carry noise a geocoder cannot
match, so `geocode-cities.ts` retries each name several ways: stripping a
dash-appended province (`Agouim-OUARZAZAT` → `Agouim`), expanding Arabic-chat
digits (`Ain Na9bi` → `Ain Naqbi`), dropping a `Douar` prefix, and adding the
hub's province as a region hint. Results outside Morocco's bounding box are
rejected rather than stored.

A handful of small douars stay unplaceable. They remain fully usable — the
picker shows "Position inconnue" instead of a map and the order proceeds. An
admin can drop a pin from the city picker to fix one permanently; that writes
`geoSource = 'manual'`, which re-imports never overwrite.
