import { prisma } from './prisma.js';

/**
 * Global "auto-record every session" switch, persisted in the platform_settings
 * key/value table under the key `session_recording`. Cached in memory so the
 * hot socket path never hits the DB.
 *
 * When ON  → every visitor's browser records their session and the server saves it.
 * When OFF → nothing records unless a SUPER_ADMIN is actively watching that visitor.
 */
const SETTINGS_KEY = 'session_recording';
const CACHE_TTL_MS = 15_000;

let cache: { enabled: boolean; expiresAt: number } | null = null;

export const isSessionRecordingEnabled = async (): Promise<boolean> => {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.enabled;

  let enabled = false;
  try {
    const row = await prisma.platformSettings.findUnique({ where: { key: SETTINGS_KEY } });
    enabled = !!(row?.value as { enabled?: boolean } | null)?.enabled;
  } catch (err) {
    console.error('[sessionRecording] Failed to read setting:', err);
  }

  cache = { enabled, expiresAt: now + CACHE_TTL_MS };
  return enabled;
};

export const setSessionRecordingEnabled = async (enabled: boolean): Promise<boolean> => {
  await prisma.platformSettings.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: { enabled } },
    update: { value: { enabled } },
  });
  cache = { enabled, expiresAt: Date.now() + CACHE_TTL_MS };
  return enabled;
};

export const clearSessionRecordingCache = () => {
  cache = null;
};
