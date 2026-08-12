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

  const refresh = useCallback(async () => {
    invalidateCityCache();
    const data = await fetchCatalogue();
    if (mounted.current) setCatalogue(data);
  }, []);

  return { cities, loading, error, resolve, byId, bySlug, refresh };
}
