import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { citiesApi } from '../lib/api';

/**
 * Loads the city catalogue once per page load and shares it across every picker.
 *
 * The list is ~6k rows and effectively static, so refetching it per component
 * would be pure waste — several city inputs can be mounted at once on a lead
 * detail screen. The in-flight promise is shared too, so simultaneous mounts
 * make one request rather than one each.
 */

export interface City {
  id: number;
  name: string;
  slug: string;
  nameAr: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
  hubName: string | null;
  coliatyCityId: number | null;
  coliatyName: string | null;
  isDeliverable: boolean;
  isMajor: boolean;
}

interface CityCatalogue {
  cities: City[];
  /** slug of a known spelling variant -> canonical city id */
  aliases: Record<string, number>;
}

let cache: CityCatalogue | null = null;
let inFlight: Promise<CityCatalogue> | null = null;

/** Mirrors backend `citySlug` so client and server agree on what matches. */
export const citySlug = (raw: string): string =>
  (raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Finds a row in Coliaty's own deliverable list, ignoring spelling noise.
 *
 * Kept separate from the catalogue lookup because the two answer different
 * questions: this one knows what the carrier ships to *today*, which matters for
 * a city added since the last import. Comparing through `citySlug` is what makes
 * "Laâyoune" and "Laayoune" agree.
 */
export const findColiatyCity = <T extends { city_name?: string }>(
  raw: string,
  coliatyCities: T[] | null | undefined
): T | null => {
  const slug = citySlug(raw);
  if (!slug || !coliatyCities?.length) return null;
  return coliatyCities.find((c) => citySlug(c.city_name || '') === slug) || null;
};

async function fetchCatalogue(): Promise<CityCatalogue> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = citiesApi
    .list()
    .then((res) => {
      const data = res.data?.data || {};
      cache = { cities: data.cities || [], aliases: data.aliases || {} };
      return cache;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Forces the next consumer to refetch — used after an admin moves a pin. */
export function invalidateCityCache(): void {
  cache = null;
}

export function useCities(options?: { deliverableOnly?: boolean }) {
  const [catalogue, setCatalogue] = useState<CityCatalogue | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    if (cache) {
      setCatalogue(cache);
      setLoading(false);
    } else {
      setLoading(true);
      fetchCatalogue()
        .then((data) => {
          if (!mounted.current) return;
          setCatalogue(data);
          setError(null);
        })
        .catch(() => {
          if (!mounted.current) return;
          setError('Impossible de charger la liste des villes.');
        })
        .finally(() => {
          if (mounted.current) setLoading(false);
        });
    }

    // Registered on both paths: when the catalogue was already cached the effect
    // used to bail out before returning a cleanup, leaving `mounted` true after
    // unmount so a later refresh() would set state on a dead component.
    return () => {
      mounted.current = false;
    };
  }, []);

  const cities = useMemo(() => {
    const all = catalogue?.cities || [];
    return options?.deliverableOnly ? all.filter((c) => c.isDeliverable) : all;
  }, [catalogue, options?.deliverableOnly]);

  const bySlug = useMemo(() => new Map(cities.map((c) => [c.slug, c])), [cities]);
  const byId = useMemo(() => new Map(cities.map((c) => [c.id, c])), [cities]);

  /**
   * Resolves free text to a catalogue row: exact slug first, then the alias
   * table, which is what lets a lead imported as "Tangier" land on "Tanger".
   */
  const resolve = useCallback(
    (raw: string): City | null => {
      if (!raw?.trim()) return null;
      const slug = citySlug(raw);
      const direct = bySlug.get(slug);
      if (direct) return direct;
      const aliasId = catalogue?.aliases?.[slug];
      return aliasId ? byId.get(aliasId) || null : null;
    },
    [bySlug, byId, catalogue]
  );

  /**
   * The name Coliaty will actually receive for this city, or '' if they do not
   * serve it.
   *
   * Deliberately the same rule the dispatch route applies server-side
   * (lib/coliatyCityName): look the row up by slug and hand back its stored
   * `coliatyName`. Anything that decides this differently ends up telling an
   * agent a city is unrecognised while the parcel ships fine, or the reverse —
   * which is how a red badge came to sit next to a perfectly deliverable city.
   *
   * The linkage is used rather than a name comparison because our catalogue and
   * the carrier disagree on far more than accents: of 444 deliverable cities 107
   * are spelled differently, and only 31 of those differ by accents alone. The
   * import already resolved the other 76 ("Aourir" -> "Awrir") and stored the
   * answer; comparing strings here would throw that work away.
   *
   * `coliatyCities` is an optional second chance for a city the carrier has
   * added since the last import, where the catalogue cannot know yet. The alias
   * table is never consulted: it comes from the import's fuzzy pass, and
   * guessing at a destination is the wrong direction to be wrong in.
   */
  const toColiatyName = useCallback(
    (raw: string, coliatyCities?: { city_name?: string }[] | null): string => {
      if (!raw?.trim()) return '';
      const row = bySlug.get(citySlug(raw));
      if (row?.isDeliverable && row.coliatyName) return row.coliatyName;
      return findColiatyCity(raw, coliatyCities)?.city_name || '';
    },
    [bySlug]
  );

  const refresh = useCallback(async () => {
    invalidateCityCache();
    const data = await fetchCatalogue();
    if (mounted.current) setCatalogue(data);
  }, []);

  return { cities, loading, error, resolve, toColiatyName, byId, bySlug, refresh };
}
