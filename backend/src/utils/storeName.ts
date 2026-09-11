import { prisma } from '../lib/prisma.js';
import { containsBlockedWord } from './blockedWords.js';

/**
 * The store name IS the subdomain.
 *
 * A seller picks one value at registration and it becomes three things at once:
 * the host their storefront answers on (`<name>.silacod.com`), the `subdomain`
 * column `resolveStoreByHost` matches, and the store's `slug`. Every entry point
 * that accepts one — registration, the public availability probe, the
 * verification step, the OTP rename on the Domains page — validates through this
 * module, so a name accepted by one can never be rejected by another.
 */

export const RESERVED_SUBDOMAINS = [
  'admin', 'api', 'www', 'app', 'mail', 'blog', 'cdn', 'static',
  'support', 'help', 'helper', 'auth', 'login', 'register', 'root',
  'status', 'portal', 'billing', 'pay', 'checkout', 'shop', 'store',
  'dev', 'test', 'prod', 'localhost', 'system', 'secure', 'web',
  'damanesign', 'youcan', 'silacod', 'silacod-dev', 'custom',
];

export const STORE_NAME_MIN = 3;
export const STORE_NAME_MAX = 30;

/** The one shape a stored subdomain may take. */
const STORE_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function normalizeStoreName(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

/**
 * Turns free text into a candidate name — used to pre-fill the registration
 * field from a brand the user typed, never to accept input silently: whatever
 * this returns still goes through `validateStoreName`.
 */
export function slugifyStoreName(raw: unknown): string {
  // NFD splits an accented letter into base + combining mark; the ASCII filter
  // below then drops the mark, so `Boutique Amelie` and `Boutique Amélie`
  // slugify to the same candidate instead of one gaining a stray hyphen.
  return String(raw ?? '')
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, STORE_NAME_MAX)
    .replace(/-+$/g, '');
}

/**
 * Deliberately one shape rather than a discriminated union: this project builds
 * with `strictNullChecks: false`, where TypeScript cannot narrow a union by its
 * literal discriminant, so every `if (!verdict.ok) throw verdict.message` would
 * fail to compile.
 */
/**
 * The slug as a display name: `ma-super-boutique` -> `Ma Super Boutique`.
 *
 * Seeds `store.name` at provisioning. The seller typed a store name, so the
 * store should be called that — the previous default, their own full name, made
 * every new storefront read as a personal page. It is only a starting value;
 * Store Settings owns the display name from then on.
 */
export function displayNameFromStoreName(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export interface StoreNameVerdict {
  ok: boolean;
  value: string;
  /** Why it was rejected, in French. Absent when `ok`. */
  message?: string;
  /**
   * The same rejection as a stable code. The message is French-only, and the
   * sign-up form runs in three languages — the client maps this to its own
   * translation rather than showing a French sentence to an Arabic UI.
   */
  reason?: StoreNameRejection;
}

export type StoreNameRejection =
  | 'required'
  | 'length'
  | 'invalid'
  | 'reserved'
  | 'blocked'
  | 'taken';

/**
 * Shape and policy only — no database access, so it is safe to call from a
 * validator chain. Uniqueness is `isStoreNameTaken`'s job.
 */
export function validateStoreName(raw: unknown): StoreNameVerdict {
  const value = normalizeStoreName(raw);

  if (!value) {
    return { ok: false, value, reason: 'required', message: 'Le nom de la boutique est requis' };
  }
  if (value.length < STORE_NAME_MIN || value.length > STORE_NAME_MAX) {
    return {
      ok: false,
      value,
      reason: 'length',
      message: `Le nom de la boutique doit contenir entre ${STORE_NAME_MIN} et ${STORE_NAME_MAX} caractères`,
    };
  }
  if (!STORE_NAME_PATTERN.test(value)) {
    return {
      ok: false,
      value,
      reason: 'invalid',
      message:
        'Uniquement des lettres minuscules, chiffres et tirets, sans tirets consécutifs ou aux extrémités',
    };
  }
  if (RESERVED_SUBDOMAINS.includes(value)) {
    return { ok: false, value, reason: 'reserved', message: 'Ce nom de boutique est réservé' };
  }
  if (containsBlockedWord(value)) {
    return { ok: false, value, reason: 'blocked', message: 'Ce nom de boutique contient un mot interdit' };
  }

  return { ok: true, value };
}

/**
 * Both columns are checked, not just `user.subdomain`.
 *
 * `store.slug` is unique too, and legacy stores were seeded with slugs that
 * never matched a subdomain (`store-42-lx9f`, a full name). Claiming a name that
 * some other account already holds as a slug would pass the user check and then
 * blow up on P2002 halfway through provisioning.
 */
export async function isStoreNameTaken(value: string, exceptUserId?: number): Promise<boolean> {
  const notThisUser = exceptUserId ? { NOT: { id: exceptUserId } } : {};
  const notThisStore = exceptUserId ? { NOT: { userId: exceptUserId } } : {};

  const [userHit, storeHit] = await Promise.all([
    prisma.user.findFirst({
      where: { subdomain: value, ...notThisUser },
      select: { id: true },
    }),
    (prisma as any).store.findFirst({
      where: { slug: value, ...notThisStore },
      select: { id: true },
    }),
  ]);

  return !!(userHit || storeHit);
}

/**
 * Validate + uniqueness in one call, for the routes that need both.
 * Returns the same verdict shape so callers stay uniform.
 */
export async function resolveStoreName(
  raw: unknown,
  exceptUserId?: number
): Promise<StoreNameVerdict> {
  const verdict = validateStoreName(raw);
  if (!verdict.ok) return verdict;

  if (await isStoreNameTaken(verdict.value, exceptUserId)) {
    return { ok: false, value: verdict.value, reason: 'taken', message: 'Ce nom de boutique est déjà pris' };
  }

  return verdict;
}
