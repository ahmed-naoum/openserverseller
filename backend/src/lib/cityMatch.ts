/**
 * City name matching, shared by the import pipeline and the runtime lookups.
 *
 * City names reach us from Coliaty, OpenStreetMap, Shopify/WooCommerce/YouCan
 * webhooks and hand-typed CSV imports, so the same place arrives as "Témara",
 * "TEMARA", "temara " and "Tamara". Everything is compared through `citySlug`
 * so those collapse to one key.
 */

/**
 * The canonical lookup key: lowercase, unaccented, punctuation-free, no spaces.
 *
 * Spaces are stripped rather than collapsed because the separator is the least
 * reliable part of a Moroccan place name — "El Jadida", "El-Jadida" and
 * "Eljadida" are all in live data and must land on the same row.
 */
export const citySlug = (raw: string): string =>
  (raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Trailing country/region qualifiers that integrations append to the city field.
 * "Agadir, Morocco" and "Casablanca - Maroc" have to resolve to the bare city.
 */
const QUALIFIER = /[,\-/(]\s*(morocco|maroc|marruecos|المغرب|ma)\s*\)?\s*$/i;

/** Strips integration noise before slugging. */
export const cleanCityName = (raw: string): string =>
  (raw || '').replace(QUALIFIER, '').replace(/\s+/g, ' ').trim();

/**
 * Values that are not places at all. Free-text city fields on public landing
 * pages collect test submissions and keyboard mash, and importing those as
 * cities would pollute every dropdown in the platform.
 */
const JUNK_EXACT = new Set([
  'test', 'testtest', 'na', 'n/a', 'none', 'null', 'undefined', 'x', 'xx', 'xxx',
  'aa', 'aaa', 'abc', 'azerty', 'qwerty', 'ville', 'city', 'madina', '-', '.', '..',
]);

/**
 * Rejects anything that cannot plausibly be a Moroccan locality.
 *
 * The consonant-run check is what catches keyboard mash like "jkghghvyjhb" and
 * "ertyuio": real names here always break up long consonant runs with a vowel,
 * even transliterated Amazigh ones such as "Tafraout" or "Imzouren".
 */
export const isPlausibleCityName = (raw: string): boolean => {
  const cleaned = cleanCityName(raw);
  const slug = citySlug(cleaned);

  if (slug.length < 3 || slug.length > 60) return false;
  if (JUNK_EXACT.has(slug)) return false;
  // A name made only of digits is an address fragment, not a city.
  if (!/[a-z]/.test(slug)) return false;
  if (/\d{3,}/.test(slug)) return false;
  if (/(.)\1{3,}/.test(slug)) return false;
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(slug)) return false;

  const vowels = (slug.match(/[aeiouy]/g) || []).length;
  if (vowels === 0 || vowels / slug.length < 0.15) return false;

  return true;
};

/**
 * Levenshtein distance, bounded so a long non-match bails out early instead of
 * filling a full matrix for every candidate in a 7,000-row table.
 */
const editDistance = (a: string, b: string, max: number): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
};

export interface CityCandidate {
  slug: string;
  [key: string]: unknown;
}

/**
 * Resolves a free-text city against a candidate list.
 *
 * Exact slug match wins outright. Only then does it fall back to a fuzzy match,
 * and the tolerance scales with name length — one edit for a short name, two for
 * a long one — because a blanket threshold turns "Saka" into "Safi".
 */
export function matchCity<T extends CityCandidate>(raw: string, candidates: T[]): T | null {
  const slug = citySlug(cleanCityName(raw));
  if (!slug) return null;

  const exact = candidates.find((c) => c.slug === slug);
  if (exact) return exact;

  const tolerance = slug.length <= 5 ? 0 : slug.length <= 9 ? 1 : 2;
  if (tolerance === 0) return null;

  let best: T | null = null;
  let bestDistance = tolerance + 1;

  for (const candidate of candidates) {
    const distance = editDistance(slug, candidate.slug, tolerance);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
      if (distance === 0) break;
    }
  }

  return bestDistance <= tolerance ? best : null;
}
