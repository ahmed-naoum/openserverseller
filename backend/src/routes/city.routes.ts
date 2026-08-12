/**
 * The city catalogue: the one place the platform reads delivery destinations
 * and their map coordinates from.
 *
 * The list is large (~6k rows) but almost never changes, so it is held in a
 * process-level cache and served whole. Paginating it would defeat the point —
 * every city picker in the app filters client-side so an agent typing a name
 * gets results without a round trip.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { citySlug, cleanCityName } from '../lib/cityMatch.js';

const router = Router();

export interface CityDto {
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

let cache: { cities: CityDto[]; aliases: Record<string, number>; at: number } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 30;

/** Drops the cache so a coordinate correction is visible on the next request. */
export function invalidateCityCache(): void {
  cache = null;
}

async function loadCities() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;

  const [rows, aliasRows] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: [{ isDeliverable: 'desc' }, { isMajor: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, slug: true, nameAr: true,
        latitude: true, longitude: true, region: true, hubName: true,
        coliatyCityId: true, coliatyName: true, isDeliverable: true, isMajor: true,
      },
    }),
    prisma.cityAlias.findMany({ select: { slug: true, cityId: true } }),
  ]);

  cache = {
    cities: rows,
    aliases: Object.fromEntries(aliasRows.map((a) => [a.slug, a.cityId])),
    at: Date.now(),
  };
  return cache;
}

/**
 * GET /api/cities
 *
 * `?deliverableOnly=true` narrows the list to cities Coliaty actually ships to —
 * what the dispatch screens need. Everything else gets the full catalogue so a
 * historical lead's city still resolves.
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { cities, aliases } = await loadCities();
    const deliverableOnly = req.query.deliverableOnly === 'true';

    res.json({
      status: 'success',
      data: {
        cities: deliverableOnly ? cities.filter((c) => c.isDeliverable) : cities,
        aliases,
      },
    });
  })
);

/**
 * GET /api/cities/resolve?name=...
 *
 * Turns a free-text city — from a webhook, a CSV import, a landing page — into a
 * catalogue row, going through the alias table first.
 */
router.get(
  '/resolve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const raw = String(req.query.name || '');
    if (!raw.trim()) throw new AppException(400, 'Paramètre "name" requis.');

    const { cities, aliases } = await loadCities();
    const slug = citySlug(cleanCityName(raw));

    const direct = cities.find((c) => c.slug === slug);
    const viaAlias = direct ? null : cities.find((c) => c.id === aliases[slug]);

    res.json({
      status: 'success',
      data: {
        city: direct || viaAlias || null,
        matchedVia: direct ? 'slug' : viaAlias ? 'alias' : null,
      },
    });
  })
);

/**
 * PATCH /api/cities/:id/coordinates
 *
 * Lets an admin drag the pin to the real location when a geocode landed wrong.
 * Marked `manual` so a later re-import of the OSM dump leaves the fix alone.
 */
router.patch(
  '/:id/coordinates',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new AppException(400, 'Latitude invalide.');
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new AppException(400, 'Longitude invalide.');
    }

    const before = await prisma.city.findUnique({ where: { id } });
    if (!before) throw new AppException(404, 'Ville introuvable.');

    const city = await prisma.city.update({
      where: { id },
      data: { latitude, longitude, geoSource: 'manual' },
    });

    invalidateCityCache();

    // Coordinates drive where couriers are told to go, so a change of position
    // is recorded with who moved it and from where.
    try {
      await prisma.activityLog.create({
        data: {
          userId: (req as any).user?.id ?? null,
          action: 'CITY_COORDINATES_UPDATED',
          modelType: 'City',
          modelId: id,
          changes: JSON.stringify({
            city: before.name,
            from: { latitude: before.latitude, longitude: before.longitude, source: before.geoSource },
            to: { latitude, longitude, source: 'manual' },
          }),
        },
      });
    } catch (err) {
      console.error('[cities] audit write failed:', err);
    }

    res.json({ status: 'success', data: { city } });
  })
);

export default router;
