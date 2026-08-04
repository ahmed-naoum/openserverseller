/**
 * Runtime configuration store: database first, .env as fallback.
 *
 * Values are cached in memory so hot paths never hit the database. The cache is
 * populated at boot by loadSecrets() and refreshed on every write, so a change
 * made in the admin dashboard takes effect immediately without a redeploy.
 *
 * Resolution order for getSecret(KEY):
 *   1. app_secrets row (decrypted)     — set by an admin
 *   2. process.env[KEY]                — .env / systemd / PM2
 *   3. undefined
 *
 * Bootstrap keys (DATABASE_URL, ENCRYPTION_KEY, JWT_SECRET, NODE_ENV, PORT) are
 * never read from the database — always use process.env directly for those.
 */

import { prisma } from './prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { isManagedKey } from '../config/secretRegistry.js';

/** key -> plaintext value, decrypted once at load/write time. */
const cache = new Map<string, string>();
let loaded = false;

/**
 * crypto.ts falls back to a *random* key when ENCRYPTION_KEY is unset, which
 * would make anything written now unreadable after the next restart. Writes are
 * refused unless a real key is configured.
 */
export function isEncryptionKeyConfigured(): boolean {
  const key = process.env.ENCRYPTION_KEY;
  return typeof key === 'string' && key.length === 32;
}

/** Loads every stored value into memory. Called once at boot. */
export async function loadSecrets(): Promise<void> {
  try {
    const rows = await prisma.appSecret.findMany();
    cache.clear();
    for (const row of rows) {
      if (!isManagedKey(row.key)) continue; // registry changed since the row was written
      const plain = decrypt(row.value);
      // decrypt() returns its input unchanged when it fails; a value that still
      // carries the ENC: prefix means the current ENCRYPTION_KEY cannot read it.
      if (plain.startsWith('ENC:')) {
        console.error(
          `[secretStore] Cannot decrypt "${row.key}" with the current ENCRYPTION_KEY. ` +
            `Falling back to process.env.${row.key}.`
        );
        continue;
      }
      cache.set(row.key, plain);
    }
    loaded = true;
    console.log(`[secretStore] Loaded ${cache.size} configuration value(s) from the database.`);
  } catch (err) {
    // Never block boot: the app keeps running on .env values alone.
    console.error('[secretStore] Failed to load configuration from database:', err);
    loaded = false;
  }
}

/** Database value if set, otherwise the environment value. */
export function getSecret(key: string): string | undefined {
  const stored = cache.get(key);
  if (stored !== undefined && stored !== '') return stored;
  return process.env[key];
}

/** getSecret with a default for callers that need a guaranteed string. */
export function getSecretOr(key: string, fallback: string): string {
  return getSecret(key) ?? fallback;
}

export function getSecretNumber(key: string, fallback: number): number {
  const raw = getSecret(key);
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getSecretBool(key: string, fallback = false): boolean {
  const raw = getSecret(key);
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

export type SecretSource = 'database' | 'env' | 'unset';

/** Where the effective value for `key` is currently coming from. */
export function getSource(key: string): SecretSource {
  const stored = cache.get(key);
  if (stored !== undefined && stored !== '') return 'database';
  const fromEnv = process.env[key];
  if (fromEnv !== undefined && fromEnv !== '') return 'env';
  return 'unset';
}

export function isLoaded(): boolean {
  return loaded;
}

/** Upserts a value, encrypted at rest, and refreshes the cache. */
export async function setSecret(
  key: string,
  value: string,
  actor?: { id?: number; email?: string | null }
): Promise<void> {
  if (!isManagedKey(key)) {
    throw new Error(`"${key}" is not a manageable configuration key.`);
  }
  if (!isEncryptionKeyConfigured()) {
    throw new Error(
      'ENCRYPTION_KEY is not configured (must be exactly 32 characters). ' +
        'Refusing to write — the value would become unreadable after the next restart.'
    );
  }

  const encrypted = encrypt(value);
  if (!encrypted.startsWith('ENC:')) {
    throw new Error('Encryption failed — value not saved.');
  }

  await prisma.appSecret.upsert({
    where: { key },
    update: { value: encrypted, updatedById: actor?.id, updatedByEmail: actor?.email ?? null },
    create: {
      key,
      value: encrypted,
      updatedById: actor?.id,
      updatedByEmail: actor?.email ?? null,
    },
  });

  cache.set(key, value);
}

/** Removes the database override so the value falls back to .env. */
export async function deleteSecret(key: string): Promise<void> {
  if (!isManagedKey(key)) {
    throw new Error(`"${key}" is not a manageable configuration key.`);
  }
  await prisma.appSecret.deleteMany({ where: { key } });
  cache.delete(key);
}
