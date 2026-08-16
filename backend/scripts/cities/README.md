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

## Checking the coordinates are right

A geocoder will happily return a confident answer for the wrong town. The audit
catches that by measuring every deliverable city against the **median** position
of its hub — a hub serves a compact area, so a city far from its siblings is
usually misplaced:

```bash
npm run cities:audit         # console + data/hub-audit.json
npm run cities:audit-pdf     # 14-page report at data/hub-audit.pdf (needs reportlab)
```

## The report we send Coliaty

The audit above is internal — it asks whether *our* coordinates are right. The
carrier-facing one asks the questions Coliaty cares about: is every destination
they publish matched, does their own spelling survive a round trip, and where
should the network grow.

```bash
npm run cities:coliaty-audit      # console + data/coliaty-audit.json
npm run cities:coliaty-audit-pdf  # 18-page report at repo root (needs reportlab)
```

It is graded against `data/coliaty-cities.json` — the carrier's list exactly as
their API returned it — rather than against our copy of it, since an audit that
grades our data using our data agrees with itself no matter what is wrong. Three
things it measures that the internal audit does not:

- **Round trip.** Every carrier `city_name` is pushed back through the same
  resolver a live order uses and checked to land on the row carrying that
  `city_id`. Currently 451/451.
- **Variant stress.** Each name re-tested uppercased, lowercased, accent-stripped,
  with `, Maroc` appended, hyphenated, and with spaces removed. The one deliberate
  shortfall is single-letter typos, because `matchCity` gives short names no
  tolerance at all.
- **Coverage proposals.** Non-deliverable settlements ranked by distance to the
  nearest hub centre, and a greedy set cover over the ones beyond reach, which is
  where the proposed hub sites come from.

The carrier list holds a few places twice under two `city_id`s. The collector
groups those before grading, and checks both ids sit in the same hub rather than
assuming it — two ids for one name in two hubs would be a real ambiguity.

Distance is a prompt, not a verdict. Dakhla genuinely is 650km from the Laayoune
hub; `Inzegane` genuinely is wrong, sitting on Casablanca's coordinates when
Inezgane borders Agadir. Each flag needs a human call.

## Hand corrections

`data/overrides.json` holds fixes the pipeline cannot derive, applied as the last
import phase and never gated by `--phase`, so a partial re-import cannot
reintroduce a mistake that was already fixed.

- `mergeInto` — two rows are the same place. The carrier linkage moves to the
  surviving row, the duplicate is deleted, and its name is kept as an alias.
  This is how Coliaty's `Awrir` was folded into OSM's `Aourir`: at five
  characters the fuzzy matcher will not bridge a one-edit gap, because at that
  length it would also merge genuinely distinct towns — so the split row got its
  own Nominatim lookup and landed 200km away in the High Atlas.
- `coordinates` — force a position, written as `manual`.
