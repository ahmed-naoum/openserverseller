import { prisma } from '../lib/prisma.js';

/**
 * Retention for the append-only log tables.
 *
 * These three had no purge at all and had grown to ~2.35 GB of the 4.59 GB
 * database (traffic_logs alone: 1.75M rows, zero deletes since creation). Every
 * insert also maintains their indexes, so the cost was paid on the request path.
 *
 * Windows are per-table because the tables mean different things: raw request
 * logs are only interesting while recent, whereas the audit chain is the one
 * with a compliance argument for keeping it longest.
 */
const DAYS = {
  traffic: Number(process.env.RETENTION_TRAFFIC_DAYS ?? 30),
  activity: Number(process.env.RETENTION_ACTIVITY_DAYS ?? 90),
  audit: Number(process.env.RETENTION_AUDIT_DAYS ?? 365),
};

/**
 * Deleted per statement. Small enough that each transaction is short and never
 * holds locks long enough to stall a request, large enough to drain millions of
 * rows in a reasonable number of round trips.
 */
const BATCH_SIZE = 5_000;

/**
 * Ceiling per table per run. The first run has a multi-million row backlog to
 * clear; this bounds how long that can hold the connection, and whatever is left
 * is picked up on the next run rather than in one marathon pass.
 */
const MAX_BATCHES_PER_RUN = 400;

/** Breather between batches so the purge never starves request traffic on a 2-vCPU box. */
const BATCH_PAUSE_MS = 50;

const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const STARTUP_DELAY_MS = 60 * 1000; // let the app finish booting first

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * Delete-by-subselect rather than `DELETE ... LIMIT` (which Postgres does not
 * support). The inner select is index-ordered, so each batch takes the oldest
 * rows and stops.
 */
const TARGETS = [
  {
    label: 'traffic_logs',
    days: () => DAYS.traffic,
    purge: (cutoff: Date, limit: number) => prisma.$executeRaw`
      DELETE FROM traffic_logs WHERE id IN (
        SELECT id FROM traffic_logs WHERE "timestamp" < ${cutoff}
        ORDER BY "timestamp" LIMIT ${limit}
      )`,
  },
  {
    label: 'activity_logs',
    days: () => DAYS.activity,
    purge: (cutoff: Date, limit: number) => prisma.$executeRaw`
      DELETE FROM activity_logs WHERE id IN (
        SELECT id FROM activity_logs WHERE "createdAt" < ${cutoff}
        ORDER BY "createdAt" LIMIT ${limit}
      )`,
  },
  {
    // Prunes the OLDEST rows only, so the chain head — and the cached hash new
    // writes link to — is never touched. verifyAuditChain() anchors on the
    // oldest surviving row, so a pruned prefix does not read as tampering.
    label: 'immutable_audit_logs',
    days: () => DAYS.audit,
    purge: (cutoff: Date, limit: number) => prisma.$executeRaw`
      DELETE FROM immutable_audit_logs WHERE id IN (
        SELECT id FROM immutable_audit_logs WHERE "timestamp" < ${cutoff}
        ORDER BY "timestamp" LIMIT ${limit}
      )`,
  },
] as const;

const purgeTable = async (target: (typeof TARGETS)[number]) => {
  const days = target.days();
  // A non-positive or unparseable window would otherwise delete the whole table.
  if (!Number.isFinite(days) || days <= 0) {
    console.warn(`[LogRetention] Skipping ${target.label}: invalid retention window (${days}).`);
    return 0;
  }

  const cutoff = daysAgo(days);
  let deleted = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const count = await target.purge(cutoff, BATCH_SIZE);
    deleted += count;
    if (count < BATCH_SIZE) return deleted; // drained
    await sleep(BATCH_PAUSE_MS);
  }

  console.warn(
    `[LogRetention] ${target.label}: hit the ${MAX_BATCHES_PER_RUN}-batch cap with rows still older than ` +
      `${days}d. Remainder will be purged on the next run.`
  );
  return deleted;
};

export const runLogRetention = async () => {
  for (const target of TARGETS) {
    try {
      const deleted = await purgeTable(target);
      if (deleted > 0) {
        console.log(`[LogRetention] Purged ${deleted} row(s) from ${target.label} (>${target.days()}d old).`);
      }
    } catch (error) {
      // One bad table must not stop the others from being cleaned.
      console.error(`[LogRetention] Failed to purge ${target.label}:`, error);
    }
  }
};

let started = false;

/** Starts the recurring purge. First pass runs shortly after boot, then every 6 hours. */
export const startLogRetentionCron = () => {
  if (started) return;
  started = true;
  console.log('[Cron] Log retention job started.');
  setTimeout(() => void runLogRetention(), STARTUP_DELAY_MS);
  setInterval(() => void runLogRetention(), RUN_INTERVAL_MS);
};
