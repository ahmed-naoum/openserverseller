import { prisma } from '../lib/prisma.js';

/**
 * Retention policy for saved session recordings.
 * - Anything older than RETENTION_DAYS is purged.
 * - Hard cap of MAX_RECORDINGS rows so storage can never run away even under a
 *   traffic spike; the oldest rows beyond the cap are deleted first.
 */
const RETENTION_DAYS = 7;
const MAX_RECORDINGS = 20_000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

export const runSessionCleanup = async () => {
  try {
    // 1. Age-based purge
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const byAge = await prisma.sessionRecording.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    // 2. Count-based cap: if we still exceed the cap, drop the oldest overflow.
    const total = await prisma.sessionRecording.count();
    let byCap = 0;
    if (total > MAX_RECORDINGS) {
      const overflow = total - MAX_RECORDINGS;
      const oldest = await prisma.sessionRecording.findMany({
        orderBy: { createdAt: 'asc' },
        take: overflow,
        select: { id: true },
      });
      const res = await prisma.sessionRecording.deleteMany({
        where: { id: { in: oldest.map((r) => r.id) } },
      });
      byCap = res.count;
    }

    if (byAge.count > 0 || byCap > 0) {
      console.log(
        `[SessionCleanup] Purged ${byAge.count} expired + ${byCap} over-cap recording(s).`,
      );
    }
  } catch (error) {
    console.error('[SessionCleanup] Failed to run session cleanup job:', error);
  }
};

let started = false;

/** Starts the recurring cleanup. Runs once immediately, then every 6 hours. */
export const startSessionCleanupCron = () => {
  if (started) return;
  started = true;
  console.log('[Cron] Session Recording cleanup job started.');
  void runSessionCleanup();
  setInterval(runSessionCleanup, CLEANUP_INTERVAL_MS);
};
