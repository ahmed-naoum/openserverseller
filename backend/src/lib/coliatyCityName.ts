import { prisma } from './prisma.js';
import { citySlug, cleanCityName } from './cityMatch.js';

/**
 * Translates the city stored on a lead into the spelling Coliaty publishes, at
 * the moment a parcel is handed over.
 *
 * The two sides name the same place differently by design: OpenStreetMap gives
 * us the accented French form ("Laâyoune", "Kénitra", "Fès") and the carrier
 * ships plain ASCII ("Laayoune", "Kenitra", "Fes"). schema.prisma:924 already
 * says city_name "must be sent back verbatim on dispatch" and the import stores
 * it for exactly that — but no dispatch path ever read it, so 31 of Coliaty's
 * 444 cities left with a name the carrier does not publish.
 *
 * This runs at the wire rather than in the picker on purpose. A city can reach
 * an order from a landing page, a CSV import, a Shopify/YouCan webhook or an
 * agent typing it by hand, and only some of those pass through a UI that could
 * warn anyone. Translating here is the one place that covers all of them.
 *
 * Exact slug only — never `matchCity`, whose fuzzy pass exists to guess what a
 * human meant. Guessing here would route a parcel to a hub that cannot serve it,
 * and a silently misrouted parcel is worse than one the carrier rejects by name.
 * Anything unresolved is returned untouched, so a city this cannot improve
 * behaves exactly as it does today.
 */

/**
 * Resolves a whole batch in one query, returning a pure lookup.
 *
 * Bulk dispatch assembles its parcels in a synchronous map over the leads, so
 * translating inside that loop would mean one query per parcel — the N+1 shape
 * this codebase has been removing elsewhere. The slug is computed twice per
 * name, which is cheaper than the round trip it avoids.
 */
export async function coliatyCityNameResolver(
  raws: (string | null | undefined)[]
): Promise<(raw: string | null | undefined) => string> {
  const slugs = [
    ...new Set(raws.map((r) => citySlug(cleanCityName((r || '').trim()))).filter(Boolean)),
  ];

  // `isDeliverable` is set only where the import actually linked a coliatyCityId,
  // so this cannot invent a destination for a city Coliaty does not serve.
  const rows = slugs.length
    ? await prisma.city.findMany({
        where: { slug: { in: slugs }, isDeliverable: true },
        select: { slug: true, coliatyName: true },
      })
    : [];

  const bySlug = new Map(
    rows.filter((r) => r.coliatyName).map((r) => [r.slug, r.coliatyName as string])
  );

  return (raw) => {
    const original = (raw || '').trim();
    return bySlug.get(citySlug(cleanCityName(original))) || original;
  };
}

/** Single-value form. See `coliatyCityNameResolver` for why the batch exists. */
export async function toColiatyCityName(raw: string | null | undefined): Promise<string> {
  const resolve = await coliatyCityNameResolver([raw]);
  return resolve(raw);
}
